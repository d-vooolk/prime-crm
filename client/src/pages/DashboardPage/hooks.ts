import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyticsApi, Period } from '@/api/analytics.api';
import { accountingApi, MonthlyRecordCountItem, MonthlyRevenueItem, SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { useServicemen } from '@/hooks/useReferenceData';
import { useOnAppResume } from '@/hooks/useAppResume';
import { effectiveSalaryMonth, hasSalary } from '@/utils/salary';
import { getErrorMessage } from '@/utils/errors';

export interface DashboardSummary {
  closedCount: number;
  totalRevenue: number;
  activeRecords: number;
}

export interface TopServiceItem {
  service: { name: string };
  count: number;
  total: number;
}

/** Показатели за период и помесячные ряды. Ошибка любой части показывается, а не превращается в пустые графики. */
export function useDashboardData(period: Period) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topServices, setTopServices] = useState<TopServiceItem[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueItem[]>([]);
  const [monthlyRecordCount, setMonthlyRecordCount] = useState<MonthlyRecordCountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Фоновое обновление при возврате в приложение: без скелетонов на месте уже показанных цифр
  const silentRef = useRef(false);

  useEffect(() => {
    // Быстро переключили период — ответ за прошлый не должен затереть текущий
    let cancelled = false;
    const silent = silentRef.current;
    silentRef.current = false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    Promise.allSettled([
      analyticsApi.getSummary(period) as Promise<DashboardSummary>,
      analyticsApi.getTopServices(period) as Promise<TopServiceItem[]>,
      accountingApi.getMonthlyRevenue(),
      accountingApi.getMonthlyRecordCount(),
    ]).then(([s, t, mr, mrc]) => {
      if (cancelled) return;
      // Что загрузилось — показываем, по упавшему — сообщение с повтором
      if (s.status === 'fulfilled') setSummary(s.value);
      if (t.status === 'fulfilled') setTopServices(t.value);
      if (mr.status === 'fulfilled') setMonthlyRevenue([...mr.value].reverse()); // для графика — от старых к новым
      if (mrc.status === 'fulfilled') setMonthlyRecordCount([...mrc.value].reverse());
      const failed = [s, t, mr, mrc].find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) setError(getErrorMessage(failed.reason));
      else setError(null);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);
  useOnAppResume(() => {
    silentRef.current = true;
    reload();
  });

  return { summary, topServices, monthlyRevenue, monthlyRecordCount, loading, error, reload };
}

/** Сотрудники с зарплатой, их заработок за текущий расчётный период и история по месяцам */
export function useEmployeeSalaries() {
  const servicemenQuery = useServicemen();
  const employees = useMemo(() => (servicemenQuery.data ?? []).filter(hasSalary), [servicemenQuery.data]);
  const [salaries, setSalaries] = useState<Record<string, SalaryData>>({});
  const [histories, setHistories] = useState<Record<string, SalaryHistoryItem[]>>({});
  const [loading, setLoading] = useState(false);
  // Сотрудники, по которым не удалось загрузить зарплату
  const [failedNames, setFailedNames] = useState<string[]>([]);

  useEffect(() => {
    if (!employees.length) return;
    let cancelled = false;
    setLoading(true);
    // Тот же расчётный период, что и в бухгалтерии: с 25-го числа идёт следующий месяц
    const current = effectiveSalaryMonth();
    const year = current.year();
    const month = current.month() + 1;

    Promise.all([
      Promise.allSettled(employees.map(m => accountingApi.getSalary(m.name, year, month))),
      Promise.allSettled(employees.map(m => accountingApi.getSalaryHistory(m.name))),
    ]).then(([salaryResults, historyResults]) => {
      if (cancelled) return;
      const salaryMap: Record<string, SalaryData> = {};
      const historyMap: Record<string, SalaryHistoryItem[]> = {};
      const failed: string[] = [];
      employees.forEach((m, i) => {
        const s = salaryResults[i];
        const h = historyResults[i];
        if (s.status === 'fulfilled') salaryMap[m.name] = s.value;
        historyMap[m.name] = h.status === 'fulfilled' ? h.value : [];
        if (s.status === 'rejected' || h.status === 'rejected') failed.push(m.name);
      });
      setSalaries(salaryMap);
      setHistories(historyMap);
      setFailedNames(failed);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [employees]);

  return {
    employees,
    salaries,
    histories,
    failedNames,
    loading: servicemenQuery.isPending || loading,
    // Ошибку самого списка уже показал QueryErrorReporter, здесь — для состояния вкладки
    servicemenError: servicemenQuery.isError ? getErrorMessage(servicemenQuery.error) : null,
    refetchServicemen: servicemenQuery.refetch,
  };
}
