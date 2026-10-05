import { describe, it, expect } from 'vitest';
import { planVdfOrder, vdfExpenseDescription } from '../services/accounting/vdfOrders.logic';

const pending = { status: 'PENDING' as const, amountEdited: false, shopCancelled: false };
const executed = { status: 'EXECUTED' as const, amountEdited: false, shopCancelled: false };

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

  it('у исполненного снимается пометка об отмене, если «Выполнен» вернули', () => {
    expect(planVdfOrder({ ...executed, shopCancelled: true }, true)).toEqual({ action: 'markCancelled', cancelled: false });
  });
});

describe('planVdfOrder: в магазине сняли «Выполнен»', () => {
  it('ожидающий убирается из входящих', () => {
    expect(planVdfOrder(pending, false)).toEqual({ action: 'delete' });
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
