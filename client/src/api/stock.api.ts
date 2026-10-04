import http from './http';
import { StockCategory, StockItem, StockMovement, StockMovementType } from '@/types';

export interface StockItemPayload {
  categoryId: string;
  name: string;
  sku?: string | null;
  unit?: string;
  minQuantity?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
  /** Начальный остаток — только при создании */
  quantity?: number;
}

export const stockApi = {
  getCategories: () =>
    http.get<{ data: StockCategory[] }>('/stock/categories').then(r => r.data.data),

  createCategory: (data: { name: string; parentId: string | null }) =>
    http.post<{ data: StockCategory }>('/stock/categories', data).then(r => r.data.data),

  updateCategory: (id: string, data: { name?: string; parentId?: string | null }) =>
    http.patch<{ data: StockCategory }>(`/stock/categories/${id}`, data).then(r => r.data.data),

  deleteCategory: (id: string) => http.delete(`/stock/categories/${id}`),

  /** Товары категории, поиск по всему складу (q) или только заканчивающиеся (low) */
  getItems: (params: { categoryId?: string; q?: string; low?: boolean }, signal?: AbortSignal) =>
    http.get<{ data: StockItem[] }>('/stock/items', {
      params: { categoryId: params.categoryId, q: params.q, low: params.low ? 'true' : undefined },
      signal,
    }).then(r => r.data.data),

  getLowCount: () =>
    http.get<{ data: { count: number } }>('/stock/items/low-count').then(r => r.data.data.count),

  createItem: (data: StockItemPayload) =>
    http.post<{ data: StockItem }>('/stock/items', data).then(r => r.data.data),

  updateItem: (id: string, data: Partial<Omit<StockItemPayload, 'quantity'>>) =>
    http.patch<{ data: StockItem }>(`/stock/items/${id}`, data).then(r => r.data.data),

  deleteItem: (id: string) => http.delete(`/stock/items/${id}`),

  move: (id: string, data: { type: StockMovementType; quantity: number; comment?: string }) =>
    http.post<{ data: StockItem }>(`/stock/items/${id}/movements`, data).then(r => r.data.data),

  getMovements: (id: string) =>
    http.get<{ data: StockMovement[] }>(`/stock/items/${id}/movements`).then(r => r.data.data),
};
