import { describe, it, expect } from 'vitest';
import type { StockCategory } from '@/types';
import { buildStockTree, lowCountDeep, categoryPath, canHoldItems, canHoldChildren, formatQty } from './stock.utils';

const cat = (id: string, parentId: string | null, extra: Partial<StockCategory> = {}): StockCategory => ({
  id, name: id.toUpperCase(), parentId, childrenCount: 0, itemsCount: 0, lowStockCount: 0, ...extra,
});

const categories = [
  cat('a', null, { childrenCount: 2 }),
  cat('a1', 'a', { itemsCount: 3, lowStockCount: 1 }),
  cat('a2', 'a', { childrenCount: 1 }),
  cat('a21', 'a2', { itemsCount: 1, lowStockCount: 2 }),
  cat('b', null),
];

describe('склад: дерево категорий', () => {
  it('строит дерево с листьями', () => {
    const tree = buildStockTree(categories);
    expect(tree.map(n => n.key)).toEqual(['a', 'b']);
    expect(tree[0].children?.map(n => n.key)).toEqual(['a1', 'a2']);
    expect(tree[0].isLeaf).toBe(false);
    expect(tree[1].isLeaf).toBe(true);
    expect(tree[0].children?.[1].children?.[0].key).toBe('a21');
  });

  it('считает заканчивающиеся товары по всем подкатегориям', () => {
    expect(lowCountDeep(categories, 'a')).toBe(3);
    expect(lowCountDeep(categories, 'a2')).toBe(2);
    expect(lowCountDeep(categories, 'b')).toBe(0);
  });

  it('путь категории от корня', () => {
    expect(categoryPath(categories, 'a21')).toBe('A / A2 / A21');
  });

  it('товары — только в конечной категории, подкатегории — только без товаров', () => {
    expect(canHoldItems(categories[0])).toBe(false);
    expect(canHoldItems(categories[1])).toBe(true);
    expect(canHoldChildren(categories[1])).toBe(false);
    expect(canHoldChildren(categories[4])).toBe(true);
    // Корень (категория не выбрана) — подкатегорию добавить можно
    expect(canHoldChildren(null)).toBe(true);
  });

  it('formatQty без лишних нулей', () => {
    expect(formatQty(2)).toBe('2');
    expect(formatQty(2.5)).toBe('2,5');
  });
});
