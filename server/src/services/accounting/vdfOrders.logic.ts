/**
 * Что сделать с заказом VDF, когда магазин присылает его состояние.
 * Вынесено из сервиса, чтобы покрыть тестами без базы.
 *
 * Магазин присылает одно и то же состояние повторно (ретраи, повторная отметка «Выполнен»),
 * поэтому решение зависит только от текущей записи и пришедшего состояния.
 */

export type VdfOrderState = { status: 'PENDING' | 'EXECUTED'; amountEdited: boolean; shopCancelled: boolean } | null;

export type VdfOrderPlan =
  | { action: 'create' }
  | { action: 'refresh'; keepAmount: boolean }
  | { action: 'markCancelled'; cancelled: boolean }
  | { action: 'delete' }
  | { action: 'none' };

export function planVdfOrder(current: VdfOrderState, done: boolean): VdfOrderPlan {
  if (done) {
    if (!current) return { action: 'create' };
    // Исполненный не трогаем: расход уже создан. Только снимаем пометку об отмене, если её вернули
    if (current.status === 'EXECUTED') {
      return current.shopCancelled ? { action: 'markCancelled', cancelled: false } : { action: 'none' };
    }
    return { action: 'refresh', keepAmount: current.amountEdited };
  }
  if (!current) return { action: 'none' };
  // Неисполненный просто исчезает из входящих; по исполненному решает администратор
  if (current.status === 'PENDING') return { action: 'delete' };
  return current.shopCancelled ? { action: 'none' } : { action: 'markCancelled', cancelled: true };
}

/** Описание расхода в кассе */
export function vdfExpenseDescription(shopOrderId: number, employeeName: string) {
  return `vdf.by: заказ №${shopOrderId}, ${employeeName}`;
}
