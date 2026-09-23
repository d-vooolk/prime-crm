import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { resolveCarNames } from '../services/wiki.service';
import { WIKI_MEDIA_DIR } from '../utils/uploads';

/**
 * Перенос карточек из старой вики (wiki.prime-auto.by, таблица "Cars").
 *
 * Выгрузка кладётся в UPLOADS_DIR/wiki/.legacy-import.json (точка в начале — чтобы статика его не раздавала), файлы медиа — рядом, в UPLOADS_DIR/wiki,
 * под теми же именами. Импорт запускается при каждом старте и идемпотентен: уже перенесённые
 * карточки узнаём по legacyId и пропускаем, поэтому выгрузку можно спокойно обновлять и класть заново.
 *
 * В старой вике было три текстовых поля — здесь они склеиваются в одно.
 */

const IMPORT_FILE = path.join(WIKI_MEDIA_DIR, '.legacy-import.json');

interface LegacyMedia { filename: string; originalname?: string; size?: number }
interface LegacyCar {
  id: number;
  brand: string;
  model: string;
  generation: number | string;
  description: string | null;
  frames: string | null;
  emulators: string | null;
  photos: LegacyMedia[] | null;
  videos: LegacyMedia[] | null;
  createdAt: string;
  updatedAt: string;
}

function log(msg: string) {
  console.log(`[wiki-import] ${msg}`); // eslint-disable-line no-console
}

function mergeContent(car: LegacyCar) {
  const clean = (v: string | null) => (v ?? '').replace(/\r\n/g, '\n').trim();
  const sections = [
    clean(car.description),
    clean(car.frames) && `Рамки:\n${clean(car.frames)}`,
    clean(car.emulators) && `Обманки:\n${clean(car.emulators)}`,
  ];
  return sections.filter(Boolean).join('\n\n');
}

export async function importLegacyWikiIfPresent() {
  if (!fs.existsSync(IMPORT_FILE)) return;

  let cars: LegacyCar[];
  try {
    cars = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8')) as LegacyCar[];
  } catch (e) {
    log(`выгрузка повреждена: ${(e as Error).message}`);
    return;
  }

  let imported = 0;
  for (const car of cars) {
    try {
      if (await prisma.wikiEntry.findUnique({ where: { legacyId: car.id } })) continue;

      const key = { markId: car.brand, modelId: car.model, generationId: String(car.generation) };
      const names = await resolveCarNames(key);
      if (!names) {
        log(`#${car.id} ${key.markId}/${key.modelId}/${key.generationId}: нет в справочнике, пропущено`);
        continue;
      }
      if (await prisma.wikiEntry.findUnique({ where: { markId_modelId_generationId: key } })) {
        log(`#${car.id} ${names.markName} ${names.modelName}: карточка уже заведена в CRM, пропущено`);
        continue;
      }

      const media = [
        ...(car.photos ?? []).map(m => ({ ...m, type: 'PHOTO' as const })),
        ...(car.videos ?? []).map(m => ({ ...m, type: 'VIDEO' as const })),
      ].filter(m => {
        const exists = fs.existsSync(path.join(WIKI_MEDIA_DIR, m.filename));
        if (!exists) log(`#${car.id}: нет файла ${m.filename}`);
        return exists;
      });

      await prisma.wikiEntry.create({
        data: {
          ...key,
          ...names,
          content: mergeContent(car),
          legacyId: car.id,
          createdAt: new Date(car.createdAt),
          updatedAt: new Date(car.updatedAt),
          media: {
            create: media.map(m => ({
              type: m.type,
              filename: m.filename,
              originalName: m.originalname || m.filename,
              size: m.size ?? 0,
              createdAt: new Date(car.updatedAt),
            })),
          },
        },
      });
      imported++;
    } catch (e) {
      log(`#${car.id}: ошибка — ${(e as Error).message}`);
    }
  }
  if (imported) log(`перенесено карточек: ${imported}`);
}
