import type { StockCategory } from '@/types';

export interface StockTreeNode {
  key: string;
  title: string;
  category: StockCategory;
  children?: StockTreeNode[];
  isLeaf: boolean;
}

/** Плоский список категорий → дерево для antd Tree (по алфавиту, порядок сервера сохраняется) */
export function buildStockTree(categories: StockCategory[]): StockTreeNode[] {
  const byParent = new Map<string | null, StockCategory[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const build = (parentId: string | null, guard = 0): StockTreeNode[] =>
    (byParent.get(parentId) ?? []).map(c => {
      const children = guard < 50 ? build(c.id, guard + 1) : [];
      return {
        key: c.id,
        title: c.name,
        category: c,
        children: children.length ? children : undefined,
        isLeaf: children.length === 0,
      };
    });
  return build(null);
}

/** Сколько заканчивающихся товаров в категории вместе со всеми подкатегориями */
export function lowCountDeep(categories: StockCategory[], id: string): number {
  const children = categories.filter(c => c.parentId === id);
  const own = categories.find(c => c.id === id)?.lowStockCount ?? 0;
  return own + children.reduce((s, c) => s + lowCountDeep(categories, c.id), 0);
}

/** Путь от корня до категории: «Расходники / Плёнки» */
export function categoryPath(categories: StockCategory[], id: string): string {
  const parts: string[] = [];
  let cursor = categories.find(c => c.id === id);
  for (let guard = 0; cursor && guard < 50; guard++) {
    parts.unshift(cursor.name);
    cursor = cursor.parentId ? categories.find(c => c.id === cursor!.parentId) : undefined;
  }
  return parts.join(' / ');
}

/** Можно ли положить товар: в категории нет подкатегорий */
export const canHoldItems = (c?: StockCategory | null) => !!c && c.childrenCount === 0;

/** Можно ли добавить подкатегорию: в категории нет товаров */
export const canHoldChildren = (c?: StockCategory | null) => !c || c.itemsCount === 0;

/** Количество без лишних нулей: 2 → «2», 2.5 → «2,5» */
export const formatQty = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
