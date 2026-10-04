import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { pushService, pushInBackground } from './push.service';
import { ROLES } from '../utils/roles';

/**
 * Склад: дерево категорий любой глубины и товары с остатками.
 * Правило дерева: товары лежат только в конечных категориях. В категорию с подкатегориями
 * товар не положить, а в категорию с товарами — не добавить подкатегорию.
 * Остаток меняется только движениями (приход, расход, инвентаризация) — так видна история.
 */

export interface StockItemInput {
  categoryId: string;
  name: string;
  sku?: string | null;
  unit?: string;
  minQuantity?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
  /** Начальный остаток при создании — записывается приходом */
  quantity?: number;
}

export type MovementType = 'IN' | 'OUT' | 'ADJUST';

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Товар заканчивается: задан порог и остаток на нём или ниже */
export const isLowStock = (item: { quantity: number; minQuantity: number | null }) =>
  item.minQuantity != null && item.quantity <= item.minQuantity;

async function getCategory(id: string) {
  const category = await prisma.stockCategory.findUnique({
    where: { id },
    include: { _count: { select: { children: true, items: { where: { isActive: true } } } } },
  });
  if (!category) throw new AppError('Категория не найдена', 404);
  return category;
}

async function assertNameFree(name: string, parentId: string | null, excludeId?: string) {
  const sibling = await prisma.stockCategory.findFirst({
    where: { parentId, name: { equals: name, mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
  });
  if (sibling) throw new AppError(`Категория «${name}» здесь уже есть`, 409);
}

/** Категорию можно сделать родительской, только если в ней нет товаров */
async function assertCanHaveChildren(parentId: string) {
  const parent = await getCategory(parentId);
  if (parent._count.items > 0) {
    throw new AppError(`В категории «${parent.name}» есть товары — подкатегорию в неё добавить нельзя`, 400);
  }
}

/** Товар можно положить только в конечную категорию */
async function assertLeaf(categoryId: string) {
  const category = await getCategory(categoryId);
  if (category._count.children > 0) {
    throw new AppError(`В категории «${category.name}» есть подкатегории — товар кладётся в конечную категорию`, 400);
  }
}

/** Полные пути категорий «Расходники / Плёнки / Глянец» для поиска и списков */
async function categoryPaths() {
  const all = await prisma.stockCategory.findMany({ select: { id: true, name: true, parentId: true } });
  const byId = new Map(all.map(c => [c.id, c]));
  const cache = new Map<string, string>();
  const pathOf = (id: string, guard = 0): string => {
    if (cache.has(id)) return cache.get(id)!;
    const c = byId.get(id);
    if (!c) return '';
    const p = c.parentId && guard < 50 ? `${pathOf(c.parentId, guard + 1)} / ${c.name}` : c.name;
    cache.set(id, p);
    return p;
  };
  return pathOf;
}

export const stockService = {
  /** Плоский список категорий с количеством подкатегорий, товаров и заканчивающихся товаров */
  async listCategories() {
    const [categories, items] = await Promise.all([
      prisma.stockCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { children: true } } },
      }),
      prisma.stockItem.findMany({ where: { isActive: true }, select: { categoryId: true, quantity: true, minQuantity: true } }),
    ]);
    const itemCount = new Map<string, number>();
    const lowCount = new Map<string, number>();
    for (const i of items) {
      itemCount.set(i.categoryId, (itemCount.get(i.categoryId) ?? 0) + 1);
      if (isLowStock(i)) lowCount.set(i.categoryId, (lowCount.get(i.categoryId) ?? 0) + 1);
    }
    return categories.map(({ _count, ...c }) => ({
      ...c,
      childrenCount: _count.children,
      itemsCount: itemCount.get(c.id) ?? 0,
      lowStockCount: lowCount.get(c.id) ?? 0,
    }));
  },

  async createCategory(name: string, parentId: string | null) {
    if (parentId) await assertCanHaveChildren(parentId);
    await assertNameFree(name, parentId);
    return prisma.stockCategory.create({ data: { name, parentId } });
  },

  async updateCategory(id: string, data: { name?: string; parentId?: string | null }) {
    const category = await getCategory(id);
    const parentId = data.parentId !== undefined ? data.parentId : category.parentId;
    if (data.parentId !== undefined && data.parentId !== category.parentId && data.parentId) {
      // Нельзя перенести категорию внутрь самой себя или своей подкатегории
      let cursor: string | null = data.parentId;
      for (let guard = 0; cursor && guard < 100; guard++) {
        if (cursor === id) throw new AppError('Нельзя перенести категорию внутрь самой себя', 400);
        const next: { parentId: string | null } | null = await prisma.stockCategory.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = next?.parentId ?? null;
      }
      await assertCanHaveChildren(data.parentId);
    }
    if (data.name !== undefined || data.parentId !== undefined) await assertNameFree(data.name ?? category.name, parentId, id);
    return prisma.stockCategory.update({ where: { id }, data: { name: data.name, parentId } });
  },

  async deleteCategory(id: string) {
    const category = await getCategory(id);
    const anyItems = await prisma.stockItem.count({ where: { categoryId: id } });
    if (category._count.children > 0 || anyItems > 0) {
      throw new AppError('Удалить можно только пустую категорию — без подкатегорий и товаров', 400);
    }
    await prisma.stockCategory.delete({ where: { id } });
  },

  /**
   * Товары: в категории, по поиску (название или артикул по всему складу) или только
   * заканчивающиеся. У каждого товара — путь категории и признак «заканчивается».
   */
  async listItems(filter: { categoryId?: string; q?: string; lowOnly?: boolean }) {
    const q = filter.q?.trim();
    const items = await prisma.stockItem.findMany({
      where: {
        isActive: true,
        ...(filter.categoryId && { categoryId: filter.categoryId }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }),
        ...(filter.lowOnly && { minQuantity: { not: null } }),
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    const pathOf = await categoryPaths();
    return items
      .filter(i => !filter.lowOnly || isLowStock(i))
      .map(i => ({ ...i, categoryPath: pathOf(i.categoryId), isLow: isLowStock(i) }));
  },

  async lowStockCount() {
    const items = await prisma.stockItem.findMany({
      where: { isActive: true, minQuantity: { not: null } },
      select: { quantity: true, minQuantity: true },
    });
    return items.filter(isLowStock).length;
  },

  async createItem(input: StockItemInput, userName?: string) {
    await assertLeaf(input.categoryId);
    const { quantity = 0, ...data } = input;
    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({ data: { ...data, quantity } });
      if (quantity > 0) {
        await tx.stockMovement.create({
          data: { itemId: item.id, type: 'IN', delta: quantity, quantityAfter: quantity, comment: 'Начальный остаток', userName },
        });
      }
      return item;
    });
  },

  async updateItem(id: string, input: Partial<Omit<StockItemInput, 'quantity'>>) {
    const item = await prisma.stockItem.findUnique({ where: { id } });
    if (!item || !item.isActive) throw new AppError('Товар не найден', 404);
    if (input.categoryId && input.categoryId !== item.categoryId) await assertLeaf(input.categoryId);
    return prisma.stockItem.update({ where: { id }, data: input });
  },

  /** Товар скрывается, а не удаляется: история движений остаётся */
  async deleteItem(id: string) {
    await prisma.stockItem.update({ where: { id }, data: { isActive: false } });
  },

  /**
   * Движение остатка: приход (+), расход (−) или инвентаризация (точный остаток).
   * Остаток пересчитывается в транзакции с блокировкой строки — два одновременных
   * списания не потеряют друг друга. Уйти в минус нельзя.
   */
  async move(id: string, data: { type: MovementType; quantity: number; comment?: string | null }, userName?: string) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ quantity: string; isActive: boolean }[]>`
        SELECT "quantity"::text AS quantity, "isActive" FROM "StockItem" WHERE "id" = ${id} FOR UPDATE
      `;
      const row = rows[0];
      if (!row || !row.isActive) throw new AppError('Товар не найден', 404);
      const current = Number(row.quantity);
      let after: number;
      if (data.type === 'IN') after = current + data.quantity;
      else if (data.type === 'OUT') after = current - data.quantity;
      else after = data.quantity;
      after = round3(after);
      if (after < 0) throw new AppError(`На складе только ${current} — списать ${data.quantity} нельзя`, 400);
      const delta = round3(after - current);
      const item = await tx.stockItem.update({ where: { id }, data: { quantity: after } });
      await tx.stockMovement.create({
        data: { itemId: id, type: data.type, delta, quantityAfter: after, comment: data.comment ?? null, userName },
      });
      // Напоминаем один раз — в момент, когда остаток опустился до порога, а не при каждом списании ниже
      const crossed = isLowStock(item) && !isLowStock({ quantity: current, minQuantity: item.minQuantity });
      return { item: { ...item, isLow: isLowStock(item) }, crossed };
    }).then(({ item, crossed }) => {
      if (crossed) {
        pushInBackground(() => pushService.sendToRole(ROLES.MANAGER, {
          title: 'Заканчивается на складе',
          body: `${item.name}: осталось ${item.quantity} ${item.unit}`,
          url: '/settings?tab=directory&sub=stock',
          tag: `stock-${item.id}`,
        }));
      }
      return item;
    });
  },

  async movements(id: string) {
    return prisma.stockMovement.findMany({ where: { itemId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
  },
};
