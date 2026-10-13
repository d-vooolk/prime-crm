import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { siteLeadsApi } from '@/api/siteLeads.api';

export const siteLeadKeys = {
  all: ['siteLeads'] as const,
  list: (status: 'new' | 'handled') => ['siteLeads', 'list', status] as const,
  newCount: ['siteLeads', 'newCount'] as const,
};

export const useSiteLeads = (status: 'new' | 'handled') => useQuery({
  queryKey: siteLeadKeys.list(status),
  queryFn: () => siteLeadsApi.list(status),
  // Заявки приходят с сайта сами — открытая страница обновляется
  refetchInterval: 60 * 1000,
  meta: { errorTitle: 'Не удалось загрузить заявки' },
});

/** Новые заявки — для бейджа в меню. enabled: false — роль без заявок */
export const useSiteLeadsNewCount = (enabled = true) => useQuery({
  queryKey: siteLeadKeys.newCount,
  queryFn: siteLeadsApi.newCount,
  enabled,
  staleTime: 30 * 1000,
  refetchInterval: 2 * 60 * 1000,
  meta: { silent: true },
});

export function useInvalidateSiteLeads() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: siteLeadKeys.all }), [qc]);
}
