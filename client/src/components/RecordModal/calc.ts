import type { Category, Equipment, ForeignCurrency, Currency, Service, ServicemanSplitEntry, CarGeneration } from '@/types';
import { toByn } from '@/utils/formatters';
import type { SelectedService } from './types';

// ─── Авто ──────────────────────────────────────────

/** Гос. номер в формате «1234 АА-7» */
export function formatPlateNumber(value: string): string {
  const clean = value.toUpperCase().replace(/[ -]/g, '');
  let result = '';
  for (let i = 0; i < Math.min(clean.length, 7); i++) {
    if (i === 4) result += ' ';
    if (i === 6) result += '-';
    result += clean[i];
  }
  return result;
}

/** Пробег: только цифры (до 7), с пробелами между разрядами */
export function formatMileage(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 7);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Годы выпуска поколения, от новых к старым. У записей, заведённых руками (грузовые),
 * годы могут быть не указаны — тогда разумный диапазон вместо пустого или бесконечного списка.
 */
export function generationYears(gen: Pick<CarGeneration, 'year_from' | 'year_to'> | undefined, currentYear = new Date().getFullYear()): string[] {
  if (!gen) return [];
  const to = gen.year_to || currentYear;
  const from = gen.year_from || to - 30;
  const length = Math.max(1, Math.min(to - from + 1, 100));
  return Array.from({ length }, (_, i) => String(to - i));
}

/** Хотя бы 11 цифр — полный белорусский номер с кодом страны */
export const isPhoneValid = (phone: string) => phone.replace(/\D/g, '').length >= 11;

// ─── Услуги ────────────────────────────────────────

export interface ServicesTotals {
  total: number;
  /** Минуты */
  totalTime: number;
  totalPrepaid: number;
  remaining: number;
}

export function servicesTotals(services: SelectedService[]): ServicesTotals {
  const total = services.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const totalTime = services.reduce((sum, s) => sum + s.estimatedTime * s.quantity, 0);
  const totalPrepaid = services.reduce((sum, s) => sum + (s.prepaidAmount || 0), 0);
  return { total, totalTime, totalPrepaid, remaining: total - totalPrepaid };
}

/** «2ч 5м» — ориентировочное время работ */
export const formatHoursMinutes = (minutes: number) => `${Math.floor(minutes / 60)}ч ${minutes % 60}м`;

/** Цена с пробелами между разрядами — formatter для InputNumber */
export const groupThousands = (v: string | number | undefined) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Добавить услугу в запись; повторный выбор той же услуги увеличивает количество */
export function addService(services: SelectedService[], service: Service, categoryName: string): SelectedService[] {
  if (services.some(s => s.serviceId === service.id)) {
    return services.map(s => (s.serviceId === service.id ? { ...s, quantity: s.quantity + 1 } : s));
  }
  return [
    ...services,
    {
      serviceId: service.id,
      serviceName: service.name,
      categoryName,
      price: service.standardPrice,
      quantity: 1,
      estimatedTime: service.estimatedTime,
      hasEquipment: service.hasEquipment ?? false,
      isProduct: service.isProduct ?? false,
      prepaidAmount: 0,
      prepaidByCard: false,
    },
  ];
}

/** Популярные категории и услуги — выше, при равенстве остаётся алфавитный порядок с сервера */
export function sortCategoriesByUsage(categories: Category[]): Category[] {
  const byUsage = (a: Service, b: Service) => (b.usageCount ?? 0) - (a.usageCount ?? 0);
  const categoryUsage = (cat: Category) => cat.services.reduce((sum, s) => sum + (s.usageCount ?? 0), 0);
  return [...categories]
    .sort((a, b) => categoryUsage(b) - categoryUsage(a))
    .map(cat => ({ ...cat, services: [...cat.services].sort(byUsage) }));
}

/**
 * Чистая прибыль по позиции — из неё делится сумма между сотрудниками
 * (так же, как считает модалка закрытия сделки).
 */
export function itemNetProfit(row: SelectedService, equipment: Equipment[]): number {
  if (row.isProduct) return 0;
  const retailPrice = row.hasEquipment
    ? (equipment.find(e => e.id === row.equipmentId)?.retailPrice ?? 0)
    : 0;
  return row.price * row.quantity - retailPrice;
}

/** Работа разделена минимум между двумя сотрудниками */
export const hasSplit = (row: SelectedService) => !!row.servicemanSplit && row.servicemanSplit.length >= 2;

/** Начальные строки окна разделения: сохранённое разделение или «весь заработок первому» */
export function initialSplitEntries(row: SelectedService, defaultServiceman: string, netProfit: number): ServicemanSplitEntry[] {
  if (hasSplit(row)) return row.servicemanSplit!;
  return [
    { name: row.servicemanName || defaultServiceman, amount: netProfit },
    { name: '', amount: 0 },
  ];
}

export type SplitValidation =
  | { ok: true; entries: ServicemanSplitEntry[] }
  | { ok: false; reason: 'tooFew' }
  | { ok: false; reason: 'exceeds'; total: number };

/** Проверка разделения: минимум два сотрудника и сумма не больше чистой прибыли (с допуском на копейку) */
export function validateSplit(entries: ServicemanSplitEntry[], netProfit: number): SplitValidation {
  const valid = entries.filter(e => e.name);
  if (valid.length < 2) return { ok: false, reason: 'tooFew' };
  const total = valid.reduce((sum, e) => sum + (e.amount || 0), 0);
  if (total > netProfit + 0.01) return { ok: false, reason: 'exceeds', total };
  return { ok: true, entries: valid };
}

// ─── Предоплата ────────────────────────────────────

export interface PrepayDraft {
  currency: Currency;
  /** Сумма в BYN (для BYN) */
  amount: number;
  byCard: boolean;
  currencyAmount: number;
  rate: number | null;
}

export type PrepaidFields = Pick<SelectedService,
  'prepaidAmount' | 'prepaidByCard' | 'prepaidCurrency' | 'prepaidCurrencyAmount' | 'prepaidRate'>;

export function prepayDraftFromItem(row: SelectedService): PrepayDraft {
  return {
    currency: row.prepaidCurrency || 'BYN',
    amount: row.prepaidCurrency ? 0 : row.prepaidAmount || 0,
    byCard: row.prepaidByCard || false,
    currencyAmount: row.prepaidCurrencyAmount || 0,
    rate: row.prepaidRate ?? null,
  };
}

/**
 * Поля предоплаты позиции из черновика окна. null — валюта указана без курса.
 * Валютная предоплата — только наличными, в BYN пересчитывается по курсу.
 */
export function prepaidFromDraft(d: PrepayDraft): PrepaidFields | null {
  if (d.currency === 'BYN') {
    return { prepaidAmount: d.amount, prepaidByCard: d.byCard, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null };
  }
  const hasCurrency = d.currencyAmount > 0;
  if (hasCurrency && !d.rate) return null;
  return {
    prepaidAmount: hasCurrency && d.rate ? toByn(d.currencyAmount, d.rate) : 0,
    prepaidByCard: false,
    prepaidCurrency: hasCurrency ? (d.currency as ForeignCurrency) : null,
    prepaidCurrencyAmount: hasCurrency ? d.currencyAmount : null,
    prepaidRate: hasCurrency ? d.rate : null,
  };
}
