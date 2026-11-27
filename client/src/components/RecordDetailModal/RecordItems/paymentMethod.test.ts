import { describe, expect, it } from 'vitest';
import type { Deal, RecordItem } from '@/types';
import { paymentMethodOf } from './paymentMethod';

const deal = (patch: Partial<Deal> = {}): Deal => ({
  id: 'd1', recordId: 'r1', finalPrice: 100, isPaidByBankTransfer: false,
  closedAt: '2026-11-27T10:00:00Z', equipment: [], ...patch,
});
const item = (patch: Partial<RecordItem> = {}) => ({ id: 'i1', price: 100, quantity: 1, ...patch }) as RecordItem;

describe('paymentMethodOf', () => {
  it('без сделки — null', () => {
    expect(paymentMethodOf({ deal: undefined, items: [item()] })).toBeNull();
  });

  it('наличные и безнал одним способом', () => {
    expect(paymentMethodOf({ deal: deal(), items: [item()] })).toBe('CASH');
    expect(paymentMethodOf({ deal: deal({ isPaidByBankTransfer: true }), items: [item()] })).toBe('CARD');
  });

  it('разбивка нал/карта — раздельная, вся сумма на одной части — этот способ', () => {
    expect(paymentMethodOf({ deal: deal({ splitCashAmount: 40, splitCardAmount: 60 }), items: [item()] })).toBe('SPLIT');
    expect(paymentMethodOf({ deal: deal({ splitCashAmount: 0, splitCardAmount: 100 }), items: [item()] })).toBe('CARD');
  });

  it('предоплата по РС и остаток наличными — раздельная', () => {
    const items = [item({ prepaidAmount: 30, prepaidByCard: true })];
    expect(paymentMethodOf({ deal: deal(), items })).toBe('SPLIT');
  });

  it('вся сумма предоплачена по РС — безнал', () => {
    const items = [item({ prepaidAmount: 100, prepaidByCard: true })];
    expect(paymentMethodOf({ deal: deal(), items })).toBe('CARD');
  });

  it('валюта в оплате или в предоплате', () => {
    expect(paymentMethodOf({
      deal: deal({ currencyPayments: [{ currency: 'USD', amount: 10, rate: 3 }] as Deal['currencyPayments'] }),
      items: [item()],
    })).toBe('CURRENCY');
    expect(paymentMethodOf({
      deal: deal(),
      items: [item({ prepaidAmount: 50, prepaidCurrency: 'USD' as RecordItem['prepaidCurrency'] })],
    })).toBe('CURRENCY');
  });
});
