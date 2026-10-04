import type { Record } from '@/types';

/**
 * Сколько по записи ещё не получено. У закрытой — итог сделки (предоплата уже проведена
 * через кассу, повторно не вычитаем), у остальных — сумма позиций минус внесённая предоплата.
 */
export function recordUnpaid(r: Pick<Record, 'deal' | 'items'>): number {
  if (r.deal) return r.deal.finalPrice;
  const total = r.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const prepaid = r.items.reduce((s, i) => s + (i.prepaidAmount || 0), 0);
  return Math.max(0, total - prepaid);
}
