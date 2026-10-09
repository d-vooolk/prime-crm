import { prisma, DbClient } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';

export const CLIENT_SOURCE_NAME_MAX = 60;

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

function findByName(name: string, db: DbClient = prisma) {
  return db.clientSource.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
}

/** Справочник «Источник клиента» для записей (Настройки → Источники клиентов) */
export const clientSourcesService = {
  /** Видимые источники по порядку; со скрытыми — для подписей в старых записях */
  async list(includeHidden = false) {
    const [sources, usage] = await Promise.all([
      prisma.clientSource.findMany({
        where: includeHidden ? undefined : { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.record.groupBy({
        by: ['clientSourceId'],
        where: { clientSourceId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(usage.map(u => [u.clientSourceId, u._count._all]));
    return sources.map(s => ({ ...s, usageCount: counts.get(s.id) ?? 0 }));
  },

  /** Новый источник в конец списка. Скрытый с тем же названием возвращается в список */
  async create(rawName: string) {
    const name = normalizeName(rawName);
    if (!name) throw new AppError('Укажите название источника', 400);
    const existing = await findByName(name);
    if (existing?.isActive) throw new AppError(`Источник «${name}» уже есть`, 409);
    const last = await prisma.clientSource.aggregate({ where: { isActive: true }, _max: { sortOrder: true } });
    const sortOrder = (last._max.sortOrder ?? 0) + 1;
    if (existing) {
      return prisma.clientSource.update({ where: { id: existing.id }, data: { name, isActive: true, sortOrder } });
    }
    return prisma.clientSource.create({ data: { name, sortOrder } });
  },

  async rename(id: string, rawName: string) {
    const name = normalizeName(rawName);
    if (!name) throw new AppError('Укажите название источника', 400);
    const existing = await findByName(name);
    if (existing && existing.id !== id) throw new AppError(`Источник «${name}» уже есть`, 409);
    return prisma.clientSource.update({ where: { id }, data: { name } });
  },

  /** Поменять местами с соседом сверху (-1) или снизу (+1) */
  async move(id: string, direction: -1 | 1) {
    return prisma.$transaction(async tx => {
      const list = await tx.clientSource.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true },
      });
      const from = list.findIndex(s => s.id === id);
      if (from === -1) throw new AppError('Источник не найден', 404);
      const to = from + direction;
      if (to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      // Порядок пересчитывается целиком: у старых строк sortOrder мог быть пустым или повторяться
      await Promise.all(list.map((s, i) => tx.clientSource.update({ where: { id: s.id }, data: { sortOrder: i + 1 } })));
    });
  },

  /**
   * Неиспользованный источник удаляется, а тот, что уже стоит в записях, только скрывается
   * из списка: в записях и статистике каналов он остаётся.
   */
  async remove(id: string) {
    const used = await prisma.record.count({ where: { clientSourceId: id } });
    if (used > 0) {
      await prisma.clientSource.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.clientSource.delete({ where: { id } });
    }
  },

  /** Проверка значения из формы записи: источник должен существовать */
  async assertExists(id: string, db: DbClient = prisma) {
    const source = await db.clientSource.findUnique({ where: { id }, select: { id: true } });
    if (!source) throw new AppError('Источник клиента не найден — обновите страницу', 400);
  },
};
