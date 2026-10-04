import dayjs, { Dayjs } from 'dayjs';
import type { ExpenseAnalyticsGroup, ExpenseAnalyticsMonth } from '@/api/expenses.api';

// Цветных слотов 8 (палитра в ExpensesTab.module.scss, проверена на различимость для дальтоников).
// Остальные группы на графике сворачиваются в серое «Остальное»
export const SERIES_SLOTS = 8;
export const OTHER_SERIES = { key: 'other', name: 'Остальное', color: 'var(--expenses-series-other)' };
// recharts подставляет цвет в атрибут fill/stroke SVG — var() там работает и следует теме
export const seriesColor = (slot: number) => `var(--expenses-series-${slot + 1})`;

// Системные группы — их убирает предустановка «Только операционные»
export const SYSTEM_GROUP_KEYS = ['system:founderSalary', 'system:salaryPayment', 'system:capitalTransfer', 'system:debtPayment'];

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  // Ключи групп, которые входят в серию (у «Остального» — несколько)
  groupKeys: string[];
}

export interface ChartRow {
  month: string;
  label: string;
  total: number;
  [seriesKey: string]: number | string;
}

/** Исключённые группы из localStorage; мусор в хранилище не должен ронять вкладку */
export function parseExcluded(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Слот цвета группы — по её месту среди ВСЕХ групп периода, поэтому
 * исключение одной группы не перекрашивает остальные. null — «Остальное».
 */
export function buildSlotMap(groups: ExpenseAnalyticsGroup[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  groups.forEach((g, i) => map.set(g.key, i < SERIES_SLOTS ? i : null));
  return map;
}

/** Серии графика: первые SERIES_SLOTS видимых по месту группы, остальные — в «Остальное» */
export function buildSeries(groups: ExpenseAnalyticsGroup[], excluded: Set<string>): ChartSeries[] {
  const own: ChartSeries[] = [];
  const rest: string[] = [];
  groups.forEach((g, i) => {
    if (excluded.has(g.key)) return;
    if (i < SERIES_SLOTS) own.push({ key: `s${i}`, name: g.name, color: seriesColor(i), groupKeys: [g.key] });
    else rest.push(g.key);
  });
  return rest.length ? [...own, { ...OTHER_SERIES, groupKeys: rest }] : own;
}

/** Строки графика по месяцам: сумма по каждой серии и итог месяца */
export function buildChartData(months: ExpenseAnalyticsMonth[], series: ChartSeries[]): ChartRow[] {
  return months.map(m => {
    const row: ChartRow = { month: m.month, label: dayjs(`${m.month}-01`).format('MMM YY'), total: 0 };
    for (const s of series) {
      const value = s.groupKeys.reduce((sum, key) => sum + (m.totals[key] ?? 0), 0);
      row[s.key] = value;
      row.total += value;
    }
    return row;
  });
}

/** Сколько месяцев периода уже наступило — будущие не размывают среднее */
export function countElapsedMonths(months: ExpenseAnalyticsMonth[], today: Dayjs = dayjs()): number {
  return months.filter(m => !dayjs(`${m.month}-01`).isAfter(today, 'month')).length;
}
