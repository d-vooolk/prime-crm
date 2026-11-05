import { describe, it, expect } from 'vitest';
import { cashlessCancel, cashlessClose, cashlessItems, isRecordRetained, RecordForRetention } from './liteMode.logic';

const today = new Date(2026, 10, 5);
const yesterday = new Date(2026, 10, 4, 12);
const deal = { isPaidByBankTransfer: false, splitCashAmount: null, currencyPayments: null };
const rec = (patch: Partial<RecordForRetention>): RecordForRetention => ({
  scheduledAt: yesterday, status: 'CLOSED', importKey: null, isLegalEntity: false, deal, incomeTypes: [], ...patch,
});

describe('isRecordRetained', () => {
  it('оставляет активные записи с сегодняшнего дня, в том числе с наличной предоплатой', () => {
    expect(isRecordRetained(rec({ status: 'ACTIVE', deal: null, scheduledAt: new Date(2026, 10, 5, 9) }), today)).toBe(true);
    expect(isRecordRetained(rec({ status: 'ACTIVE', deal: null, scheduledAt: new Date(2026, 10, 9), incomeTypes: ['INCOME'] }), today)).toBe(true);
  });

  it('убирает прошедшие незакрытые, отменённые и перенесённые из старой программы', () => {
    expect(isRecordRetained(rec({ status: 'ACTIVE', deal: null }), today)).toBe(false);
    expect(isRecordRetained(rec({ status: 'CANCELLED', deal: null, scheduledAt: new Date(2026, 10, 9) }), today)).toBe(false);
    expect(isRecordRetained(rec({ importKey: 'old.json', deal: { ...deal, isPaidByBankTransfer: true } }), today)).toBe(false);
  });

  it('оставляет закрытые по РС, картой и у юрлиц', () => {
    expect(isRecordRetained(rec({ deal: { ...deal, isPaidByBankTransfer: true }, incomeTypes: ['INCOME_RS'] }), today)).toBe(true);
    expect(isRecordRetained(rec({ incomeTypes: ['INCOME_RS'] }), today)).toBe(true);
    expect(isRecordRetained(rec({ isLegalEntity: true }), today)).toBe(true);
  });

  it('убирает закрытые, где была хоть часть наличными или валютой', () => {
    expect(isRecordRetained(rec({ incomeTypes: ['INCOME'] }), today)).toBe(false);
    expect(isRecordRetained(rec({ incomeTypes: ['INCOME', 'INCOME_RS'] }), today)).toBe(false);
    expect(isRecordRetained(rec({ deal: { ...deal, splitCashAmount: 50 }, incomeTypes: ['INCOME_RS'] }), today)).toBe(false);
    expect(isRecordRetained(rec({
      deal: { ...deal, isPaidByBankTransfer: true, currencyPayments: [{ currency: 'USD', amount: 10, rate: 3 }] },
    }), today)).toBe(false);
    // Предоплата наличными, остаток по РС
    expect(isRecordRetained(rec({ isLegalEntity: true, incomeTypes: ['INCOME', 'INCOME_RS'] }), today)).toBe(false);
  });

  it('убирает закрытую без признаков безнала', () => {
    expect(isRecordRetained(rec({}), today)).toBe(false);
  });
});

describe('оплата в облегчённом режиме', () => {
  it('закрытие — всё по РС', () => {
    expect(cashlessClose({ finalPrice: 100, isPaidByBankTransfer: false, splitCashAmount: 40, splitCardAmount: 60, currencyPayments: [{}] }))
      .toEqual({ finalPrice: 100, isPaidByBankTransfer: true, splitCashAmount: undefined, splitCardAmount: undefined, currencyPayments: null });
  });

  it('предоплата — по РС, без валюты', () => {
    expect(cashlessItems([{ serviceId: 's', prepaidByCard: false, prepaidCurrency: 'USD', prepaidCurrencyAmount: 10, prepaidRate: 3 }]))
      .toEqual([{ serviceId: 's', prepaidByCard: true, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null }]);
  });

  it('отмена — оставленная наличная предоплата идёт в РС', () => {
    expect(cashlessCancel({ retainedCashAmount: 30, retainedCardAmount: 20 })).toEqual({ retainedCashAmount: 0, retainedCardAmount: 50 });
    expect(cashlessCancel({})).toEqual({});
  });
});
