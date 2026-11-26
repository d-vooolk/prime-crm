import type { Deal, Record, ServicemanSplitEntry } from '@/types';
import { roundMoney } from '@/utils/formatters';

/** Позиция записи в окне закрытия сделки: с чистой прибылью и сотрудником */
export interface ItemRow {
  serviceId: string;
  itemId: string;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  estimatedTime: number;
  netProfit: number;
  servicemanName: string;
  hasEquipment: boolean;
  isProduct: boolean;
  equipmentId?: string;
  split?: ServicemanSplitEntry[] | null;
  prepaidAmount: number;
  prepaidByCard: boolean;
}

/**
 * Позиции записи → строки таблицы. Чистая прибыль: у товара 0, у услуги с оборудованием —
 * за вычетом розничной цены модуля. Сотрудник по умолчанию — исполнитель записи,
 * у товара и разделённой услуги поле пустое.
 */
export function buildItemRows(record: Pick<Record, 'items' | 'serviceman'>): ItemRow[] {
  return record.items.map(i => {
    const hasEquipment = i.service.hasEquipment ?? false;
    const isProduct = i.service.isProduct ?? false;
    const retailPrice = hasEquipment ? (i.equipment?.retailPrice ?? 0) : 0;
    return {
      serviceId: i.serviceId,
      itemId: i.id,
      serviceName: i.service.name,
      categoryName: i.service.category?.name || '',
      price: i.price,
      quantity: i.quantity,
      estimatedTime: i.service.estimatedTime || 0,
      netProfit: isProduct ? 0 : i.price * i.quantity - retailPrice,
      servicemanName: isProduct || i.servicemanSplit?.length
        ? ''
        : (i.servicemanName ?? record.serviceman ?? ''),
      hasEquipment,
      isProduct,
      equipmentId: i.equipmentId ?? undefined,
      split: !isProduct && i.servicemanSplit?.length ? i.servicemanSplit : null,
      prepaidAmount: i.prepaidAmount ?? 0,
      prepaidByCard: i.prepaidByCard ?? false,
    };
  });
}

export const isSplit = (row: Pick<ItemRow, 'split'>) => !!row.split && row.split.length >= 2;

/** Услуги, по которым не выбран сотрудник (товары и разделённые не в счёт) */
export function itemsMissingServiceman(rows: ItemRow[]): ItemRow[] {
  return rows.filter(i => !i.isProduct && !isSplit(i) && !i.servicemanName);
}

/**
 * Выбран основной сотрудник: он проставляется в услуги без сотрудника и в те, где стоял
 * прежний основной. Заполненные другими, разделённые и товары не меняются; очистка поля позиции не трогает
 */
export function applyMainServiceman(rows: ItemRow[], prev: string, next: string): ItemRow[] {
  if (!next) return rows;
  return rows.map(i => {
    if (i.isProduct || isSplit(i)) return i;
    if (i.servicemanName && i.servicemanName !== prev) return i;
    return { ...i, servicemanName: next };
  });
}

export interface PaymentTotals {
  total: number;
  prepaidCash: number;
  prepaidCard: number;
  totalPrepaid: number;
  /** Остаток к оплате после предоплаты */
  remaining: number;
  /** Остаток в рублях после валюты; отрицательный — клиенту сдача */
  rubleRemaining: number;
}

export function paymentTotals(rows: Pick<ItemRow, 'price' | 'quantity' | 'prepaidAmount' | 'prepaidByCard'>[], currencyByn = 0): PaymentTotals {
  const total = rows.reduce((s, i) => s + i.price * i.quantity, 0);
  const prepaidCash = rows.reduce((s, i) => s + (!i.prepaidByCard ? i.prepaidAmount : 0), 0);
  const prepaidCard = rows.reduce((s, i) => s + (i.prepaidByCard ? i.prepaidAmount : 0), 0);
  const totalPrepaid = prepaidCash + prepaidCard;
  const remaining = Math.max(0, total - totalPrepaid);
  return { total, prepaidCash, prepaidCard, totalPrepaid, remaining, rubleRemaining: roundMoney(remaining - currencyByn) };
}

/**
 * Разбивка рублёвого остатка на нал/безнал. Отправляется, только если её задали
 * и платить рублями ещё есть что.
 */
export function splitPayment(rubleRemaining: number, cardAmount: number | null) {
  if (cardAmount == null || rubleRemaining <= 0) return {};
  return { splitCashAmount: roundMoney(rubleRemaining - cardAmount), splitCardAmount: cardAmount };
}

export type SplitValidation =
  | { ok: true; entries: ServicemanSplitEntry[] }
  | { ok: false; reason: 'tooFew' }
  | { ok: false; reason: 'exceeds'; total: number };

/** Разделение услуги: минимум двое с именем, сумма долей не больше чистой прибыли (копейка допуска) */
export function validateSplit(entries: ServicemanSplitEntry[], netProfit: number | undefined): SplitValidation {
  const valid = entries.filter(e => e.name);
  if (valid.length < 2) return { ok: false, reason: 'tooFew' };
  const total = valid.reduce((s, e) => s + (e.amount || 0), 0);
  if (netProfit != null && total > netProfit + 0.01) return { ok: false, reason: 'exceeds', total };
  return { ok: true, entries: valid };
}

/** Строка исправленного акта: позиция записи, в акте ли она и её сумма (цена × кол-во) */
export interface ActLine {
  itemId: string;
  included: boolean;
  amount: number;
}

export const actLinesOf = (record: Pick<Record, 'items'>): ActLine[] =>
  record.items.map(i => ({ itemId: i.id, included: true, amount: roundMoney(i.price * i.quantity) }));

export const actLinesTotal = (lines: ActLine[]) =>
  roundMoney(lines.reduce((s, l) => s + (l.included ? l.amount : 0), 0));

/**
 * Запись для печати исправленного акта (при раздельной оплате): только оставленные позиции
 * с новыми суммами, итог — их сумма, модули — оставленных позиций. Нигде не сохраняется.
 * Поля сделки — из формы закрытия: сделка может быть ещё не закрыта
 */
export function correctedActRecord(
  record: Record,
  lines: ActLine[],
  form: { defects?: string; recommendations?: string; warranty?: string },
): Record {
  const items = record.items.flatMap(item => {
    const line = lines.find(l => l.itemId === item.id);
    if (!line?.included) return [];
    return [{ ...item, price: line.amount / item.quantity }];
  });
  const equipment = [...new Map(items.flatMap(i => (i.equipment ? [[i.equipment.id, i.equipment] as const] : []))).values()];
  const deal: Deal = {
    id: record.deal?.id ?? '',
    recordId: record.id,
    isPaidByBankTransfer: record.deal?.isPaidByBankTransfer ?? false,
    closedAt: record.deal?.closedAt ?? new Date().toISOString(),
    finalPrice: actLinesTotal(lines),
    recommendations: form.recommendations || undefined,
    warranty: form.warranty || undefined,
    equipment: equipment.map(e => ({ equipment: e })),
  };
  return { ...record, defects: form.defects || undefined, items, deal };
}
