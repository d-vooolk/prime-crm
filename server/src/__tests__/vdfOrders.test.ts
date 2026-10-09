import { describe, it, expect } from 'vitest';
import {
  planVdfOrder, planVdfPayment, vdfCancellation, vdfExpenseDescription, vdfNotPendingMessage, vdfPaidTotal, vdfPayments,
} from '../services/accounting/vdfOrders.logic';

const pending = { status: 'PENDING' as const, amountEdited: false, shopCancelled: false, paid: false };
const partial = { ...pending, paid: true };
const executed = { status: 'EXECUTED' as const, amountEdited: false, shopCancelled: false, paid: true };
const cancelled = { status: 'CANCELLED' as const, amountEdited: false, shopCancelled: false, paid: false };

describe('planVdfOrder: заказ выполнен в магазине', () => {
  it('новый заказ появляется во входящих', () => {
    expect(planVdfOrder(null, true)).toEqual({ action: 'create' });
  });

  it('повтор по ожидающему обновляет данные и сумму', () => {
    expect(planVdfOrder(pending, true)).toEqual({ action: 'refresh', keepAmount: false });
  });

  it('поправленную вручную сумму магазин не перезаписывает', () => {
    expect(planVdfOrder({ ...pending, amountEdited: true }, true)).toEqual({ action: 'refresh', keepAmount: true });
  });

  it('после частичной оплаты сумму магазин не перезаписывает', () => {
    expect(planVdfOrder(partial, true)).toEqual({ action: 'refresh', keepAmount: true });
  });

  it('исполненный не трогается', () => {
    expect(planVdfOrder(executed, true)).toEqual({ action: 'none' });
  });

  it('отменённый в бухгалтерии остаётся отменённым', () => {
    expect(planVdfOrder(cancelled, true)).toEqual({ action: 'none' });
  });

  it('у исполненного снимается пометка об отмене, если «Выполнен» вернули', () => {
    expect(planVdfOrder({ ...executed, shopCancelled: true }, true)).toEqual({ action: 'markCancelled', cancelled: false });
  });
});

describe('planVdfOrder: в магазине сняли «Выполнен»', () => {
  it('ожидающий убирается из входящих', () => {
    expect(planVdfOrder(pending, false)).toEqual({ action: 'delete' });
  });

  it('отменённый убирается вместе с заказом', () => {
    expect(planVdfOrder(cancelled, false)).toEqual({ action: 'delete' });
  });

  it('частично оплаченный остаётся с пометкой — расход на решение администратора', () => {
    expect(planVdfOrder(partial, false)).toEqual({ action: 'markCancelled', cancelled: true });
  });

  it('исполненный остаётся с пометкой — расход на решение администратора', () => {
    expect(planVdfOrder(executed, false)).toEqual({ action: 'markCancelled', cancelled: true });
  });

  it('повторная отмена ничего не меняет', () => {
    expect(planVdfOrder({ ...executed, shopCancelled: true }, false)).toEqual({ action: 'none' });
  });

  it('неизвестный заказ игнорируется', () => {
    expect(planVdfOrder(null, false)).toEqual({ action: 'none' });
  });
});

describe('vdfExpenseDescription', () => {
  it('номер заказа и сотрудник', () => {
    expect(vdfExpenseDescription(152, 'Иванов Иван')).toBe('vdf.by: заказ №152, Иванов Иван');
  });
});

describe('planVdfPayment', () => {
  it('без суммы — весь остаток, заказ исполнен', () => {
    expect(planVdfPayment(100, 30)).toEqual({ ok: true, amount: 70, full: true });
  });

  it('часть остатка — частичная оплата', () => {
    expect(planVdfPayment(100, 0, 40.5)).toEqual({ ok: true, amount: 40.5, full: false });
  });

  it('сумма, равная остатку, — полное исполнение (с копейками)', () => {
    expect(planVdfPayment(100.3, 0.1, 100.2)).toEqual({ ok: true, amount: 100.2, full: true });
  });

  it('больше остатка нельзя', () => {
    expect(planVdfPayment(100, 60, 50)).toEqual({ ok: false, message: 'Сумма больше остатка (40 р.)' });
  });

  it('оплачено полностью — нечего оплачивать', () => {
    expect(planVdfPayment(100, 100).ok).toBe(false);
  });
});

describe('vdfPaidTotal', () => {
  it('сумма расходов без ошибок округления', () => {
    expect(vdfPaidTotal([{ cashTransaction: { amount: 0.1 } }, { cashTransaction: { amount: 0.2 } }])).toBe(0.3);
  });
});

describe('vdfPayments', () => {
  const date = new Date('2026-10-06T10:00:00.000Z');
  const order = {
    shopOrderId: 152, status: 'PENDING' as const, employeeName: 'Иванов Иван', executedByName: null, amount: 100,
  };

  it('каждый расход — отдельная оплата, у частичной — остаток', () => {
    expect(vdfPayments({
      ...order,
      payments: [
        { paidByName: 'Пётр', cashTransaction: { amount: 30, date, person: 'Анна' } },
        { paidByName: 'Пётр', cashTransaction: { amount: 20, date, person: null } },
      ],
    })).toEqual([
      { orderId: 152, employeeName: 'Иванов Иван', amount: 30, paidAt: '2026-10-06T10:00:00.000Z', person: 'Анна', remaining: 50 },
      { orderId: 152, employeeName: 'Иванов Иван', amount: 20, paidAt: '2026-10-06T10:00:00.000Z', person: 'Пётр', remaining: 50 },
    ]);
  });

  it('у исполненного остатка нет, даже если расход в кассе поправили', () => {
    const [payment] = vdfPayments({
      ...order, status: 'EXECUTED', payments: [{ paidByName: null, cashTransaction: { amount: 90, date, person: null } }],
    });
    expect(payment.remaining).toBe(0);
  });
});

describe('vdfCancellation', () => {
  const base = { shopOrderId: 152, updatedAt: new Date('2026-10-07T09:00:00.000Z') };

  it('дата, кто отменил и причина', () => {
    expect(vdfCancellation({
      ...base, cancelledAt: new Date('2026-10-07T10:00:00.000Z'), cancelledByName: 'Анна', cancelReason: 'дубль',
    })).toEqual({ orderId: 152, cancelledAt: '2026-10-07T10:00:00.000Z', person: 'Анна', reason: 'дубль' });
  });

  it('без даты отмены — время последнего изменения, пустые поля — пустые строки', () => {
    expect(vdfCancellation({ ...base, cancelledAt: null, cancelledByName: null, cancelReason: null })).toEqual({
      orderId: 152, cancelledAt: '2026-10-07T09:00:00.000Z', person: '', reason: '',
    });
  });
});

describe('vdfNotPendingMessage', () => {
  it('по статусу', () => {
    expect(vdfNotPendingMessage('CANCELLED')).toBe('Заказ отменён');
    expect(vdfNotPendingMessage('EXECUTED')).toBe('Заказ уже исполнен');
  });
});
