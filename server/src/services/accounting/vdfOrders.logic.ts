/**
 * Что сделать с заказом VDF, когда магазин присылает его состояние.
 * Вынесено из сервиса, чтобы покрыть тестами без базы.
 *
 * Магазин присылает одно и то же состояние повторно (ретраи, повторная отметка «Выполнен»),
 * поэтому решение зависит только от текущей записи и пришедшего состояния.
 */

export type VdfOrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

export type VdfOrderState = { status: VdfOrderStatus; amountEdited: boolean; shopCancelled: boolean } | null;

export type VdfOrderPlan =
  | { action: 'create' }
  | { action: 'refresh'; keepAmount: boolean }
  | { action: 'markCancelled'; cancelled: boolean }
  | { action: 'delete' }
  | { action: 'none' };

export function planVdfOrder(current: VdfOrderState, done: boolean): VdfOrderPlan {
  if (done) {
    if (!current) return { action: 'create' };
    // Отменённый в бухгалтерии остаётся отменённым, сколько бы магазин ни присылал его снова
    if (current.status === 'CANCELLED') return { action: 'none' };
    // Исполненный не трогаем: расход уже создан. Только снимаем пометку об отмене, если её вернули
    if (current.status === 'EXECUTED') {
      return current.shopCancelled ? { action: 'markCancelled', cancelled: false } : { action: 'none' };
    }
    return { action: 'refresh', keepAmount: current.amountEdited };
  }
  if (!current) return { action: 'none' };
  // Неисполненный и отменённый просто исчезают; по исполненному решает администратор
  if (current.status !== 'EXECUTED') return { action: 'delete' };
  return current.shopCancelled ? { action: 'none' } : { action: 'markCancelled', cancelled: true };
}

/** Описание расхода в кассе */
export function vdfExpenseDescription(shopOrderId: number, employeeName: string) {
  return `vdf.by: заказ №${shopOrderId}, ${employeeName}`;
}

export interface VdfPaidOrder {
  shopOrderId: number;
  employeeName: string;
  executedByName: string | null;
  cashTransaction: { amount: number; date: Date; person: string | null } | null;
}

/** Оплата для магазина: заказ считается оплаченным, пока в кассе есть его расход */
export function vdfPayment(order: VdfPaidOrder) {
  const tx = order.cashTransaction;
  if (!tx) return null;
  return {
    orderId: order.shopOrderId,
    employeeName: order.employeeName,
    amount: tx.amount,
    paidAt: tx.date.toISOString(),
    person: tx.person ?? order.executedByName ?? '',
  };
}

export interface VdfCancelledOrder {
  shopOrderId: number;
  cancelledAt: Date | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  updatedAt: Date;
}

/** Отмена для магазина: когда, кто и почему */
export function vdfCancellation(order: VdfCancelledOrder) {
  return {
    orderId: order.shopOrderId,
    cancelledAt: (order.cancelledAt ?? order.updatedAt).toISOString(),
    person: order.cancelledByName ?? '',
    reason: order.cancelReason ?? '',
  };
}

/** Почему заказ нельзя исполнить или поправить — по его статусу */
export function vdfNotPendingMessage(status: VdfOrderStatus) {
  return status === 'CANCELLED' ? 'Заказ отменён' : 'Заказ уже исполнен';
}
