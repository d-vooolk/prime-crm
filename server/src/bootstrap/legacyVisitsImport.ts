import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { UPLOADS_DIR } from '../utils/uploads';
import {
  CatalogMark, LegacyVisitInput, formatPhone, importNotes, matchCar, matchServices, nameKey,
  overlapsCrmRecord, phoneKey, splitPrice,
} from '../services/legacyVisits.logic';

/**
 * Перенос визитов из старой программы (заявки и акты из папки «Клиенты», документы юрлиц)
 * в историю клиентов — обычными записями со статусом «Завершена».
 *
 * Выгрузку готовит scripts/legacy-visits-prepare.ts, она кладётся в UPLOADS_DIR/.legacy-visits.json
 * (точка в начале — статика её не раздаёт). Импорт запускается при старте и идемпотентен: запись
 * узнаётся по Record.importKey. Когда всё перенесено без ошибок, файл удаляется — в нём личные данные.
 *
 * Данные CRM главнее: у найденного клиента не меняются ни имя, ни авто, ни записи — визит только
 * добавляется в его историю. Визит, который уже заведён в CRM записью на те же дни, пропускается.
 * У перенесённых записей нет сделки: в кассу, зарплату и выручку они не попадают, а из статистики
 * (дашборд, источники, календарь) исключены по importKey.
 */

const IMPORT_FILE = path.join(UPLOADS_DIR, '.legacy-visits.json');

/** Справочник авто из базы (вместе с ручными записями) в виде для matchCar. */
async function loadCatalog(): Promise<CatalogMark[]> {
  const marks = await prisma.carMark.findMany({
    select: {
      id: true,
      name: true,
      models: {
        select: {
          externalId: true,
          name: true,
          generations: { select: { externalId: true, name: true, yearFrom: true, yearTo: true } },
        },
      },
    },
  });
  return marks.map(m => ({
    id: m.id,
    name: m.name,
    models: m.models.map(mo => ({
      id: mo.externalId,
      name: mo.name,
      generations: mo.generations.map(g => ({ id: g.externalId, name: g.name, yearFrom: g.yearFrom, yearTo: g.yearTo })),
    })),
  }));
}

/** Авто, которого нет в справочнике (грузовики, «Квадроцикл»): марка — первое слово, модель — остальное. */
function freeTextCar(text: string) {
  const [brand, ...rest] = text.trim().split(/\s+/);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
  return {
    brand: brand || 'Авто не указано',
    brandId: `legacy-${slug(brand ?? '')}`,
    model: rest.join(' ') || '—',
    modelId: `legacy-${slug(text)}`,
  };
}

const orNull = (s: string) => s || null;

export async function importLegacyVisitsIfPresent() {
  if (!fs.existsSync(IMPORT_FILE)) return;

  let visits: LegacyVisitInput[];
  try {
    visits = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8')) as LegacyVisitInput[];
  } catch (err) {
    logger.error('старые визиты: выгрузка повреждена', { err });
    return;
  }

  const catalog = await loadCatalog();
  const done = new Set(
    (await prisma.record.findMany({ where: { importKey: { not: null } }, select: { importKey: true } }))
      .map(r => r.importKey!),
  );

  // Услуги по названию (активная важнее скрытой с тем же названием), сотрудники, оборудование
  const services = new Map<string, { id: string; standardPrice: number; hasEquipment: boolean }>();
  for (const s of await prisma.service.findMany({ orderBy: { isActive: 'asc' } })) {
    services.set(s.name, { id: s.id, standardPrice: s.standardPrice, hasEquipment: s.hasEquipment });
  }
  const staff = new Set((await prisma.serviceman.findMany({ select: { name: true } })).map(s => s.name));
  const equipment = await prisma.equipment.findMany({ select: { id: true, name: true } });
  const equipmentId = (text: string) =>
    equipment.find(e => e.name.trim().toLowerCase() === text.trim().toLowerCase())?.id ?? null;

  // Клиенты CRM по телефону и ФИО; юрлица — по УНП из записей
  const clients = await prisma.client.findMany({ select: { id: true, name: true, phone: true }, orderBy: { createdAt: 'asc' } });
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const c of clients) {
    const key = phoneKey(c.phone);
    if (key.length === 9 && !byPhone.has(key)) byPhone.set(key, c.id);
    const n = nameKey(c.name);
    if (n) byName.set(n, [...(byName.get(n) ?? []), c.id]);
  }
  const byUnp = new Map<string, string>();
  for (const r of await prisma.record.findMany({
    where: { legalUnp: { not: null } },
    select: { legalUnp: true, clientId: true },
    orderBy: { scheduledAt: 'desc' },
  })) {
    if (r.legalUnp && !byUnp.has(r.legalUnp)) byUnp.set(r.legalUnp, r.clientId);
  }

  const stats = { imported: 0, newClients: 0, newCars: 0, withoutServices: 0, alreadyInCrm: 0, noClient: 0, errors: 0 };
  const skipped: string[] = [];

  // Сначала визиты с телефоном: созданные по ним клиенты находятся потом и для файлов без номера
  // (по ФИО, УНП) — результат один и тот же с первого запуска, повторный ничего не добавляет
  const ordered = [...visits.filter(v => v.phone), ...visits.filter(v => !v.phone)];

  for (const v of ordered) {
    if (done.has(v.key)) continue;
    try {
      // Клиент: телефон → УНП юрлица → ФИО (только для файлов без телефона, и только однозначное)
      let clientId = v.phone ? byPhone.get(phoneKey(v.phone)) : undefined;
      if (!clientId && v.legal?.unp) clientId = byUnp.get(v.legal.unp);
      if (!clientId && !v.phone) {
        const ids = byName.get(nameKey(v.name)) ?? [];
        if (ids.length === 1) clientId = ids[0];
      }
      if (!clientId && !v.phone) {
        stats.noClient++;
        skipped.push(`${v.key}: нет телефона и клиент не найден в CRM`);
        continue;
      }

      if (clientId) {
        // Сверяем только с записями, заведёнными в CRM, а не с перенесёнными
        const records = await prisma.record.findMany({
          where: { clientId, status: { not: 'CANCELLED' }, importKey: null },
          select: { scheduledAt: true },
        });
        if (overlapsCrmRecord(v, records.map(r => r.scheduledAt.toISOString().slice(0, 10)))) {
          stats.alreadyInCrm++;
          continue;
        }
      }

      // Услуги и цена визита: итоговая, иначе первоначальная — делится по стандартным ценам
      const matched = matchServices(v.jobReason)
        .map(name => services.get(name))
        .filter((s): s is NonNullable<typeof s> => !!s);
      const total = v.finalPrice ?? v.initialPrice ?? 0;
      const prices = splitPrice(total, matched.map(s => s.standardPrice));
      if (matched.length === 0) stats.withoutServices++;

      const knownServiceman = staff.has(v.serviceman) ? v.serviceman : null;
      const match = matchCar(v.carText, v.year, catalog);
      const phone = v.phone;

      await prisma.$transaction(async tx => {
        let id = clientId;
        if (!id) {
          const created = await tx.client.create({
            data: { name: v.name || v.representative || 'Без имени', phone: formatPhone(phone!) },
          });
          id = created.id;
          stats.newClients++;
        }

        // Своё авто клиента той же модели — по году, иначе любое. Существующие авто не меняются
        const carKey = match
          ? { brand: match.brand, brandId: match.brandId, model: match.model, modelId: match.modelId }
          : freeTextCar(v.carText);
        const cars = await tx.car.findMany({ where: { clientId: id, brandId: carKey.brandId, modelId: carKey.modelId } });
        let car = cars.find(c => c.year === v.year) ?? cars[0];
        if (!car) {
          car = await tx.car.create({
            data: {
              clientId: id,
              ...carKey,
              generation: match?.generationName ?? null,
              generationId: match?.generationId ?? null,
              generationName: match?.generationName ?? null,
              year: v.year,
              plateNumber: orNull(v.plate),
              mileage: orNull(v.mileage),
            },
          });
          stats.newCars++;
        }

        await tx.record.create({
          data: {
            importKey: v.key,
            clientId: id,
            carId: car.id,
            scheduledAt: new Date(`${v.date}T10:00:00+03:00`),
            status: 'CLOSED',
            serviceman: knownServiceman,
            notes: importNotes(v, !knownServiceman),
            defects: orNull(v.defects),
            isLegalEntity: !!v.legal,
            legalCompanyName: v.legal?.companyName || null,
            legalUnp: v.legal?.unp || null,
            legalVin: v.legal ? orNull(v.vin) : null,
            items: {
              create: matched.map((s, i) => ({
                serviceId: s.id,
                price: prices[i],
                quantity: 1,
                equipmentId: s.hasEquipment && v.equipment ? equipmentId(v.equipment) : null,
              })),
            },
          },
        });

        // Следующие визиты того же нового клиента находят его по телефону, ФИО и УНП
        if (!clientId && phone) {
          const newId = id;
          byPhone.set(phoneKey(phone), newId);
          const n = nameKey(v.name);
          if (n) byName.set(n, [...(byName.get(n) ?? []), newId]);
          if (v.legal?.unp && !byUnp.has(v.legal.unp)) byUnp.set(v.legal.unp, newId);
        }
      });
      stats.imported++;
    } catch (err) {
      stats.errors++;
      logger.error('старые визиты: визит не перенесён', { key: v.key, err });
    }
  }

  for (const line of skipped) logger.info(`старые визиты: пропущен ${line}`);
  logger.info('старые визиты: перенос завершён', stats);
  if (stats.errors === 0) fs.unlinkSync(IMPORT_FILE);
}
