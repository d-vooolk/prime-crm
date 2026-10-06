import { describe, it, expect } from 'vitest';
import { planVdfOrder, vdfCancellation, vdfExpenseDescription, vdfNotPendingMessage, vdfPayment } from '../services/accounting/vdfOrders.logic';

const pending = { status: 'PENDING' as const, amountEdited: false, shopCancelled: false };
const executed = { status: 'EXECUTED' as const, amountEdited: false, shopCancelled: false };
const cancelled = { status: 'CANCELLED' as const, amountEdited: false, shopCancelled: false };

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

describe('vdfPayment', () => {
  const order = { shopOrderId: 152, employeeName: 'Иванов Иван', executedByName: 'Пётр' };

  it('сумма, дата и изыматель берутся из расхода в кассе', () => {
    const date = new Date('2026-10-06T10:00:00.000Z');
    expect(vdfPayment({ ...order, cashTransaction: { amount: 87.5, date, person: 'Анна' } })).toEqual({
      orderId: 152, employeeName: 'Иванов Иван', amount: 87.5, paidAt: '2026-10-06T10:00:00.000Z', person: 'Анна',
    });
  });

  it('без изымателя в расходе — тот, кто исполнил', () => {
    const date = new Date('2026-10-06T10:00:00.000Z');
    expect(vdfPayment({ ...order, cashTransaction: { amount: 10, date, person: null } })?.person).toBe('Пётр');
  });

  it('расход удалён — оплаты нет', () => {
    expect(vdfPayment({ ...order, cashTransaction: null })).toBeNull();
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
