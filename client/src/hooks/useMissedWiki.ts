import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '@/api/accounting.api';

/**
 * Упущенная премия за вики в текущем расчётном периоде: менеджер получает всех сотрудников,
 * сотрудник — себя. Общий кеш для дашборда и раздела «Вики».
 */
export const useMissedWiki = () => useQuery({
  queryKey: ['missed-wiki'],
  queryFn: () => accountingApi.getMissedWiki(),
});
