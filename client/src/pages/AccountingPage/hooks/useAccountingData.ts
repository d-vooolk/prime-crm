import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { accountingApi, vdfOrdersApi, VdfOrderStatus } from '@/api/accounting.api';

/**
 * Данные бухгалтерии через react-query: одно действие затрагивает несколько вкладок
 * (выплата ЗП меняет и расчёт, и кассу; погашение долга — долги, кассу и капитал),
 * поэтому после изменений инвалидируются группы ключей, а не вызываются чужие загрузчики.
 */
export const accountingKeys = {
  cash: ['accounting', 'cash'] as const,
  capital: ['accounting', 'capital'] as const,
  debts: ['accounting', 'debts'] as const,
  founderSalaries: ['accounting', 'founderSalaries'] as const,
  salary: ['accounting', 'salary'] as const,
  salaryHistory: ['accounting', 'salaryHistory'] as const,
  monthlyRevenue: ['accounting', 'monthlyRevenue'] as const,
  monthlyRecordCount: ['accounting', 'monthlyRecordCount'] as const,
  vdfOrders: ['accounting', 'vdfOrders'] as const,
};

export type AccountingGroup = keyof typeof accountingKeys;

// Деньги могли поменять с другого устройства: при каждом заходе перезапрашиваем, показывая кеш.
// Ошибку показывает сама вкладка (Alert с «Повторить»), поэтому глобальное уведомление выключено.
const FRESH = { staleTime: 0, meta: { silent: true } } as const;

export const useCashMonth = (month: Dayjs, enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.cash, 'month', month.year(), month.month() + 1],
  queryFn: () => accountingApi.getCash(month.year(), month.month() + 1),
  placeholderData: keepPreviousData,
  enabled,
  ...FRESH,
});

export const useCashBalance = (enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.cash, 'balance'],
  queryFn: accountingApi.getBalance,
  enabled,
  ...FRESH,
});

export const useCapital = (enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.capital, 'list'],
  queryFn: accountingApi.getCapital,
  enabled,
  ...FRESH,
});

export const useCapitalBalance = (enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.capital, 'balance'],
  queryFn: accountingApi.getCapitalBalance,
  enabled,
  ...FRESH,
});

export const useDebts = (archived: boolean, enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.debts, archived],
  queryFn: () => accountingApi.getDebts(archived),
  enabled,
  ...FRESH,
});

export const useFounderSalaries = (enabled: boolean) => useQuery({
  queryKey: accountingKeys.founderSalaries,
  queryFn: accountingApi.getFounderSalaries,
  enabled,
  ...FRESH,
});

export const useSalary = (employee: string, month: Dayjs) => useQuery({
  queryKey: [...accountingKeys.salary, employee, month.year(), month.month() + 1],
  queryFn: () => accountingApi.getSalary(employee, month.year(), month.month() + 1),
  enabled: !!employee,
  // Пока грузится другой месяц, таблица остаётся на месте со спиннером, как раньше
  placeholderData: keepPreviousData,
  ...FRESH,
});

export const useSalaryHistory = (employee: string) => useQuery({
  queryKey: [...accountingKeys.salaryHistory, employee],
  queryFn: () => accountingApi.getSalaryHistory(employee),
  enabled: !!employee,
  ...FRESH,
});

export const useMonthlyRevenue = (enabled: boolean) => useQuery({
  queryKey: accountingKeys.monthlyRevenue,
  queryFn: accountingApi.getMonthlyRevenue,
  enabled,
  ...FRESH,
});

export const useMonthlyRecordCount = (enabled: boolean) => useQuery({
  queryKey: accountingKeys.monthlyRecordCount,
  queryFn: accountingApi.getMonthlyRecordCount,
  enabled,
  ...FRESH,
});

export const useVdfOrders = (status: VdfOrderStatus, enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.vdfOrders, 'list', status],
  queryFn: () => vdfOrdersApi.list(status),
  enabled,
  ...FRESH,
});

// Счётчик на вкладке: новые заказы приходят из магазина сами, поэтому опрашиваем
export const useVdfPendingCount = (enabled: boolean) => useQuery({
  queryKey: [...accountingKeys.vdfOrders, 'pendingCount'],
  queryFn: vdfOrdersApi.pendingCount,
  enabled,
  refetchInterval: 2 * 60_000,
  ...FRESH,
});

/** Перезапросить группы данных бухгалтерии после изменения */
export function useInvalidateAccounting() {
  const qc = useQueryClient();
  return useCallback(
    (...groups: AccountingGroup[]) => Promise.all(groups.map(g => qc.invalidateQueries({ queryKey: accountingKeys[g] }))),
    [qc],
  );
}
