import type { MonthlyRecordCountItem, MonthlyRevenueItem, SalaryHistoryItem } from '@/api/accounting.api';

export interface AvgCheckItem {
  key: string;
  labelShort: string;
  label: string;
  avg: number;
}

/** Средний чек по месяцам: выручка месяца / число записей; месяцы без записей — 0 */
export function buildAvgCheckData(revenue: MonthlyRevenueItem[], recordCount: MonthlyRecordCountItem[]): AvgCheckItem[] {
  const rcMap = new Map(recordCount.map(r => [r.key, r.count]));
  return revenue.map(r => {
    const count = rcMap.get(r.key) ?? 0;
    return { key: r.key, labelShort: r.labelShort, label: r.label, avg: count > 0 ? r.amount / count : 0 };
  });
}

/** Средний чек за всё время — среднее по месяцам, где были записи */
export function overallAvgCheck(data: AvgCheckItem[]): number {
  const months = data.filter(r => r.avg > 0);
  if (months.length === 0) return 0;
  return months.reduce((s, r) => s + r.avg, 0) / months.length;
}

/** Рекордный месяц заработка (при равенстве — первый) */
export function bestSalaryMonth(history: SalaryHistoryItem[]): SalaryHistoryItem | null {
  return history.length > 0 ? history.reduce((max, h) => h.adjustedTotal > max.adjustedTotal ? h : max) : null;
}

/** Подпись оси в тысячах: 12500 → «13к» */
export const formatThousands = (v: number) => `${(v / 1000).toFixed(0)}к`;
