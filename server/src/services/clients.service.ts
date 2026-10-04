import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { parseDay, nextDay } from '../utils/date';

/** Фильтры списка клиентов (GET /api/clients). Все поля необязательные и комбинируются через И. */
export interface ClientsFilter {
  /** Старый общий поиск: имя или телефон как есть */
  search?: string;
  /** Только цифры телефона, ищутся в любом месте номера */
  phone?: string;
  /** Часть ФИО без учёта регистра */
  name?: string;
  brandId?: string;
  modelId?: string;
  generationId?: string;
  /** Часть госномера — без пробелов/дефисов, кириллица приравнена к латинице */
  plate?: string;
  /** Клиенты, которым делали эту услугу (в записи, кроме отменённых) */
  serviceId?: string;
  /** Период записи YYYY-MM-DD, включительно */
  from?: string;
  to?: string;
}


/**
 * Условие на записи для фильтра «услуга за период». null — фильтр не задан.
 * Одна и та же запись должна подходить и по услуге, и по дате.
 */
function buildRecordWhere(filter: ClientsFilter): Prisma.RecordWhereInput | null {
  if (!filter.serviceId && !filter.from && !filter.to) return null;
  const scheduledAt: Prisma.DateTimeFilter = {};
  if (filter.from) scheduledAt.gte = parseDay(filter.from);
  if (filter.to) scheduledAt.lt = nextDay(parseDay(filter.to));
  return {
    status: { not: 'CANCELLED' },
    ...((filter.from || filter.to) && { scheduledAt }),
    ...(filter.serviceId && { items: { some: { serviceId: filter.serviceId } } }),
  };
}

// Буквы, которые на номерах пишут то кириллицей, то латиницей
const PLATE_CYR = 'АВЕКМНОРСТХУІ';
const PLATE_LAT = 'ABEKMHOPCTXYI';

/** Приводит госномер к виду для сравнения: верхний регистр, латиница, только буквы и цифры. */
export function normalizePlate(value: string): string {
  let out = '';
  for (const ch of value.toUpperCase()) {
    const i = PLATE_CYR.indexOf(ch);
    out += i >= 0 ? PLATE_LAT[i] : ch;
  }
  return out.replace(/[^0-9A-ZА-ЯЁ]/g, '');
}

/**
 * id клиентов, в номере которых встречается последовательность цифр.
 * Номера хранятся с маской («+375 (29) 123-45-67»), поэтому сравниваем
 * по цифрам — средствами Prisma это не выразить, нужен сырой SQL.
 */
async function clientIdsByPhoneDigits(digits: string): Promise<string[]> {
  // Сюда приходят только цифры, спецсимволов LIKE в шаблоне не бывает
  const pattern = `%${digits}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Client"
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${pattern}
  `;
  return rows.map(r => r.id);
}

/** id автомобилей, госномер которых содержит введённый фрагмент (после нормализации). */
async function carIdsByPlate(plate: string): Promise<string[]> {
  // После нормализации остаются только буквы и цифры — экранировать нечего
  const pattern = `%${normalizePlate(plate)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Car"
    WHERE "plateNumber" IS NOT NULL
      AND regexp_replace(
            translate(upper("plateNumber"), ${PLATE_CYR}, ${PLATE_LAT}),
            '[^0-9A-ZА-ЯЁ]', '', 'g'
          ) LIKE ${pattern}
  `;
  return rows.map(r => r.id);
}

/** Собирает where для списка клиентов из фильтров. */
async function buildWhere(filter: ClientsFilter): Promise<Prisma.ClientWhereInput> {
  const and: Prisma.ClientWhereInput[] = [];

  if (filter.search) {
    and.push({
      OR: [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
      ],
    });
  }
  if (filter.name) {
    and.push({ name: { contains: filter.name, mode: 'insensitive' } });
  }
  if (filter.phone) {
    and.push({ id: { in: await clientIdsByPhoneDigits(filter.phone) } });
  }

  // Условия по авто относятся к одной машине: «BMW X5 с номером 1234» —
  // это одна и та же машина, а не BMW и какой-то другой автомобиль с номером
  const car: Prisma.CarWhereInput = {};
  if (filter.brandId) car.brandId = filter.brandId;
  if (filter.modelId) car.modelId = filter.modelId;
  if (filter.generationId) car.generationId = filter.generationId;
  if (filter.plate && normalizePlate(filter.plate)) {
    car.id = { in: await carIdsByPlate(filter.plate) };
  }
  if (Object.keys(car).length > 0) and.push({ cars: { some: car } });

  const recordWhere = buildRecordWhere(filter);
  if (recordWhere) and.push({ records: { some: recordWhere } });

  return and.length > 0 ? { AND: and } : {};
}

export const clientsService = {
  async findAll(filter: ClientsFilter = {}) {
    const recordWhere = buildRecordWhere(filter);
    const clients = await prisma.client.findMany({
      where: await buildWhere(filter),
      include: {
        cars: true,
        _count: { select: { records: true } },
        // Подходящие под фильтр записи — какая машина и когда
        ...(recordWhere && {
          records: {
            where: recordWhere,
            select: { id: true, scheduledAt: true, status: true, car: true },
            orderBy: { scheduledAt: 'desc' },
          },
        }),
      },
      orderBy: { name: 'asc' },
    });
    // Отдаём отдельным полем: records у клиента — это вся история (GET /clients/:id)
    return clients.map(({ records, ...client }) => (records ? { ...client, matchedRecords: records } : client));
  },

  /** Подсказки для автодополнения по имени: немного клиентов вместе с авто. */
  async suggest(query: string, limit: number) {
    return prisma.client.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      include: { cars: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
  },

  async findByPhone(phone: string) {
    // Сравниваем по цифрам, чтобы находилось и при другом формате записи номера
    const digits = phone.replace(/\D/g, '');
    if (!digits) return [];
    return prisma.client.findMany({
      where: { id: { in: await clientIdsByPhoneDigits(digits) } },
      include: { cars: true },
      take: 5,
    });
  },

  async findById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        cars: true,
        records: {
          include: {
            car: true,
            items: { include: { service: { include: { category: true } } } },
            deal: true,
          },
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });
    if (!client) throw new AppError('Клиент не найден', 404);
    return client;
  },

  async create(data: { name: string; phone: string; notes?: string }) {
    const existing = await prisma.client.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Клиент с таким номером уже существует', 409);
    return prisma.client.create({ data, include: { cars: true } });
  },

  async update(id: string, data: Partial<{ name: string; phone: string; notes: string }>) {
    await clientsService.findById(id);
    return prisma.client.update({
      where: { id },
      data,
      include: { cars: true },
    });
  },
};
