import type { Record } from '@/types';
import { roundMoney } from '@/utils/formatters';

export type PaymentMethod = 'CASH' | 'CARD' | 'SPLIT' | 'CURRENCY';

export const PAYMENT_METHOD_LABELS: { [K in PaymentMethod]: { letter: string; title: string } } = {
  CASH: { letter: 'Н', title: 'Наличными' },
  CARD: { letter: 'Б', title: 'Безнал' },
  SPLIT: { letter: 'Р', title: 'Раздельная оплата' },
  CURRENCY: { letter: 'В', title: 'Оплата валютой' },
};

/**
 * Как оплачена закрытая сделка. Валюта (в остатке или в предоплате) — «В».
 * Иначе собираем рублёвые части: предоплаты (нал/РС) и остаток (разбивка нал/карта или весь одним способом);
 * есть и нал, и безнал — «Р». Сделки нет — null.
 */
export function paymentMethodOf(r: Pick<Record, 'deal' | 'items'>): PaymentMethod | null {
  const deal = r.deal;
  if (!deal) return null;
  if (deal.currencyPayments?.length || r.items.some(i => i.prepaidCurrency && (i.prepaidAmount || 0) > 0)) {
    return 'CURRENCY';
  }

  let cash = false;
  let card = false;
  let prepaid = 0;
  for (const i of r.items) {
    const amount = i.prepaidAmount || 0;
    if (amount <= 0) continue;
    prepaid += amount;
    if (i.prepaidByCard) card = true;
    else cash = true;
  }

  const remaining = roundMoney(deal.finalPrice - prepaid);
  if (deal.splitCardAmount != null) {
    if (deal.splitCardAmount > 0) card = true;
    if ((deal.splitCashAmount ?? 0) > 0) cash = true;
  } else if (remaining > 0 || (!cash && !card)) {
    if (deal.isPaidByBankTransfer) card = true;
    else cash = true;
  }

  if (cash && card) return 'SPLIT';
  return card ? 'CARD' : 'CASH';
}
