import dayjs, { Dayjs } from 'dayjs';
import type {
  Debt, FounderSalaryRecord, MonthlyRecordCountItem, MonthlyRevenueItem, SalaryHistoryItem,
} from '@/api/accounting.api';

// ─── Описания системных расходов ─────────────────────

export const FOUNDER_SALARY_PREFIX = 'ЗП учредителя';
// Расход «ЗП сотрудника …» создаётся только кнопкой «Выплатить ЗП», иначе не попадёт в остаток сотрудника
export const EMPLOYEE_SALARY_PREFIX = 'ЗП сотрудника';

const startsWithPrefix = (description: string | null | undefined, prefix: string) =>
  !!description && description.trim().toLowerCase().startsWith(prefix.toLowerCase());

export const isFounderSalaryDescription = (description?: string | null) =>
  startsWithPrefix(description, FOUNDER_SALARY_PREFIX);
export const isEmployeeSalaryDescription = (description?: string | null) =>
  startsWithPrefix(description, EMPLOYEE_SALARY_PREFIX);
export const isLinkedSalaryDescription = (description?: string | null) =>
  isFounderSalaryDescription(description) || isEmployeeSalaryDescription(description);

/** Правило формы: ЗП учредителя и сотрудника нельзя завести обычным расходом */
export const founderDescriptionRule = {
  validator: (_: unknown, value?: string) => {
    if (isFounderSalaryDescription(value)) {
      return Promise.reject(new Error('Для ЗП учредителя включите свитч «ЗП учредителей»'));
    }
    if (isEmployeeSalaryDescription(value)) {
      return Promise.reject(new Error('ЗП сотрудника выплачивается кнопкой «Выплатить ЗП» в расчёте ЗП'));
    }
    return Promise.resolve();
  },
};

// ─── Форматирование и ввод ───────────────────────────

export function formatDate(s: string) {
  return dayjs(s).format('DD.MM.YYYY');
}

/** Парсер InputNumber: запятая как десятичный разделитель */
export const parseAmount = (v?: string) => parseFloat((v ?? '').replace(/,/g, '.')) || 0;

/** Ключ месяца как в ответах сервера: YYYY-MM */
export const monthKey = (d: Dayjs) => `${d.year()}-${String(d.month() + 1).padStart(2, '0')}`;

export const CAPITAL_CURRENCY_OPTIONS = [
  { value: 'BYN', label: 'BYN (рубли)' },
  { value: 'USD', label: 'USD (доллары)' },
  { value: 'EUR', label: 'EUR (евро)' },
];

// ─── Долги ───────────────────────────────────────────

/** Сколько уже погашено (в валюте долга) */
export const debtPaidTotal = (d: Pick<Debt, 'payments'>) => d.payments.reduce((s, p) => s + p.amount, 0);

// ─── Выплата ЗП ──────────────────────────────────────

/**
 * Изменили сумму на карту: разница переносится из наличных, общая сумма выплаты сохраняется.
 * На карту больше всей суммы — наличных просто не остаётся.
 */
export function cashAfterCardChange(cash: number, prevCard: number, nextCard: number): number {
  const total = cash + prevCard;
  return Math.max(0, Math.round((total - nextCard) * 100) / 100);
}

/** Рекорд заработка: максимальный месяц; в первый месяц работы — текущее начисление */
export function salaryRecord(history: SalaryHistoryItem[], currentTotal?: number): { amount: number; label: string } | null {
  if (history.length === 0) return null;
  const best = history.reduce((max, h) => (h.adjustedTotal > max.adjustedTotal ? h : max));
  if (history.length === 1) return { amount: currentTotal ?? best.adjustedTotal, label: 'Первый месяц' };
  return { amount: best.adjustedTotal, label: best.label };
}

// ─── ЗП учредителей ──────────────────────────────────

export interface FounderRow {
  key: string;
  year: number;
  month: number;
  director: number;
  creator: number;
}

export interface FounderSummary {
  rows: FounderRow[];
  directorTotal: number;
  creatorTotal: number;
  /** Насколько один получил меньше другого */
  diff: number;
  /** Кто получил меньше; при равенстве сумм — создатель (diff тогда 0 и не показывается) */
  less: 'director' | 'creator';
}

/** Выплаты учредителям по месяцам (MM.YYYY, по возрастанию) и итог, кто недополучил */
export function summarizeFounderSalaries(
  records: FounderSalaryRecord[],
  directorName?: string,
  creatorName?: string,
): FounderSummary {
  const map = new Map<string, FounderRow>();
  let directorTotal = 0;
  let creatorTotal = 0;
  for (const r of records) {
    const key = `${String(r.month).padStart(2, '0')}.${r.year}`;
    if (!map.has(key)) map.set(key, { key, year: r.year, month: r.month, director: 0, creator: 0 });
    const row = map.get(key)!;
    if (directorName && r.person === directorName) { row.director += r.amount; directorTotal += r.amount; }
    if (creatorName && r.person === creatorName) { row.creator += r.amount; creatorTotal += r.amount; }
  }
  const rows = Array.from(map.values()).sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  return {
    rows,
    directorTotal,
    creatorTotal,
    diff: Math.abs(directorTotal - creatorTotal),
    less: directorTotal < creatorTotal ? 'director' : 'creator',
  };
}

// ─── Статистика: выручка, записи, средний чек ────────

export interface StatsChartPoint {
  key: string;
  labelShort: string;
  label: string;
  amount: number;
  count: number;
  avg: number;
}

/** Точки графика по всем месяцам, где есть выручка или записи, от старых к новым */
export function buildStatsChartData(revenue: MonthlyRevenueItem[], recordCount: MonthlyRecordCountItem[]): StatsChartPoint[] {
  const revMap = new Map(revenue.map(r => [r.key, r]));
  const countMap = new Map(recordCount.map(r => [r.key, r.count]));
  const keys = Array.from(new Set([...revMap.keys(), ...countMap.keys()])).sort();
  return keys.map(key => {
    const rev = revMap.get(key);
    const count = countMap.get(key) ?? 0;
    const amount = rev?.amount ?? 0;
    return {
      key,
      labelShort: rev?.labelShort ?? key,
      label: rev?.label ?? key,
      amount,
      count,
      avg: count > 0 ? amount / count : 0,
    };
  });
}

export interface AvgCheckRow {
  key: string;
  label: string;
  avg: number;
}

/** Средний чек по месяцам, от новых к старым; без записей — 0 */
export function buildAvgCheckRows(revenue: MonthlyRevenueItem[], recordCount: MonthlyRecordCountItem[]): AvgCheckRow[] {
  return buildStatsChartData(revenue, recordCount)
    .reverse()
    .map(({ key, label, avg }) => ({ key, label, avg }));
}

/** Средний чек за всё время — среднее по месяцам, где он есть */
export function overallAvgCheck(rows: AvgCheckRow[]): number {
  const months = rows.filter(r => r.avg > 0);
  if (months.length === 0) return 0;
  return months.reduce((s, r) => s + r.avg, 0) / months.length;
}

/**
 * Кого подставить в «Изыматель» и похожие поля: того, кто вошёл, если он есть в списке поля,
 * иначе сотрудника по умолчанию из справочника
 */
export function pickDefaultPerson(userName: string | undefined, list: { name: string }[], fallback: string): string {
  return userName && list.some(s => s.name === userName) ? userName : fallback;
}
