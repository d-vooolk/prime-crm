import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { stockApi } from '@/api/stock.api';

export const stockKeys = {
  all: ['stock'] as const,
  categories: ['stock', 'categories'] as const,
  items: (params: { categoryId?: string; q?: string; low?: boolean }) => ['stock', 'items', params] as const,
  lowCount: ['stock', 'lowCount'] as const,
  movements: (itemId: string) => ['stock', 'movements', itemId] as const,
};

export const useStockCategories = () => useQuery({
  queryKey: stockKeys.categories,
  queryFn: stockApi.getCategories,
  meta: { errorTitle: 'Не удалось загрузить категории склада' },
});

/** Товары: категории, поиска или «заканчивается». Без условий — не запрашиваем */
export const useStockItems = (params: { categoryId?: string; q?: string; low?: boolean }) => useQuery({
  queryKey: stockKeys.items(params),
  queryFn: ({ signal }) => stockApi.getItems(params, signal),
  enabled: !!(params.categoryId || params.q || params.low),
  placeholderData: keepPreviousData,
  meta: { errorTitle: 'Не удалось загрузить товары склада' },
});

/** Сколько товаров заканчивается — для бейджей и напоминания в расписании */
export const useStockLowCount = (enabled = true) => useQuery({
  queryKey: stockKeys.lowCount,
  queryFn: stockApi.getLowCount,
  enabled,
  // Напоминание не должно отставать надолго, но и дёргать сервер постоянно незачем
  staleTime: 60 * 1000,
  refetchInterval: 10 * 60 * 1000,
  meta: { silent: true },
});

export const useStockMovements = (itemId: string | null) => useQuery({
  queryKey: stockKeys.movements(itemId ?? ''),
  queryFn: () => stockApi.getMovements(itemId!),
  enabled: !!itemId,
  meta: { errorTitle: 'Не удалось загрузить историю движений' },
});

/** После любого изменения на складе — перечитать категории, товары и счётчик */
export function useInvalidateStock() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: stockKeys.all }), [queryClient]);
}
