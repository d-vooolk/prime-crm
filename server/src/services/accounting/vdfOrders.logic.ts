/**
 * Что сделать с заказом VDF, когда магазин присылает его состояние.
 * Вынесено из сервиса, чтобы покрыть тестами без базы.
 *
 * Магазин присылает одно и то же состояние повторно (ретраи, повторная отметка «Выполнен»),
 * поэтому решение зависит только от текущей записи и пришедшего состояния.
 */

export type VdfOrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

/** paid — есть оплата (расход в кассе), даже частичная */
export type VdfOrderState = {
  status: VdfOrderStatus;
  amountEdited: boolean;
  shopCancelled: boolean;
  paid: boolean;
} | null;

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
    // После частичной оплаты сумму не перезаписываем: остаток считается от неё
    return { action: 'refresh', keepAmount: current.amountEdited || current.paid };
  }
  if (!current) return { action: 'none' };
  // Неоплаченный и отменённый просто исчезают; по оплаченному (и частично) решает администратор
  if (current.status === 'CANCELLED' || (current.status === 'PENDING' && !current.paid)) return { action: 'delete' };
  return current.shopCancelled ? { action: 'none' } : { action: 'markCancelled', cancelled: true };
}

/** Описание расхода в кассе */
export function vdfExpenseDescription(shopOrderId: number, employeeName: string) {
  return `vdf.by: заказ №${shopOrderId}, ${employeeName}`;
}

const toCents = (value: number) => Math.round(value * 100);

/** Сколько оплачено: сумма расходов в кассе */
export function vdfPaidTotal(payments: Array<{ cashTransaction: { amount: number } }>) {
  return payments.reduce((sum, p) => sum + toCents(p.cashTransaction.amount), 0) / 100;
}

/** Остаток к оплате, не меньше нуля */
export function vdfRemaining(amount: number, paid: number) {
  return Math.max(0, toCents(amount) - toCents(paid)) / 100;
}

export type VdfPaymentPlan = { ok: true; amount: number; full: boolean } | { ok: false; message: string };

/**
 * Сколько провести расходом при исполнении. Без суммы — весь остаток.
 * Сумма, равная остатку, — тоже полное исполнение
 */
export function planVdfPayment(amount: number, paid: number, requested?: number): VdfPaymentPlan {
  const remaining = toCents(vdfRemaining(amount, paid));
  if (remaining <= 0) return { ok: false, message: 'По заказу нечего оплачивать' };
  const pay = requested === undefined ? remaining : toCents(requested);
  if (pay <= 0) return { ok: false, message: 'Сумма должна быть больше нуля' };
  if (pay > remaining) return { ok: false, message: `Сумма больше остатка (${remaining / 100} р.)` };
  return { ok: true, amount: pay / 100, full: pay === remaining };
}

export interface VdfBulkOrder {
  id: string;
  amount: number;
  paid: number;
}

export type VdfBulkPlan =
  | { ok: true; payments: Array<{ id: string; amount: number; full: boolean }> }
  | { ok: false; message: string };

/**
 * Выплата одной суммой по всем ожидающим заказам: заказы оплачиваются по порядку (старые первыми),
 * на последнем сумма может кончиться — он оплачивается частично и остаётся с остатком
 */
export function planVdfBulkPayment(orders: VdfBulkOrder[], requested: number): VdfBulkPlan {
  const owed = orders.map(o => ({ id: o.id, remaining: toCents(vdfRemaining(o.amount, o.paid)) }))
    .filter(o => o.remaining > 0);
  const total = owed.reduce((sum, o) => sum + o.remaining, 0);
  if (total <= 0) return { ok: false, message: 'Невыплаченных заказов нет' };
  let left = toCents(requested);
  if (left <= 0) return { ok: false, message: 'Сумма должна быть больше нуля' };
  if (left > total) return { ok: false, message: `Сумма больше невыплаченного (${total / 100} р.)` };

  const payments: Array<{ id: string; amount: number; full: boolean }> = [];
  for (const o of owed) {
    if (left <= 0) break;
    const pay = Math.min(o.remaining, left);
    payments.push({ id: o.id, amount: pay / 100, full: pay === o.remaining });
    left -= pay;
  }
  return { ok: true, payments };
}

export interface VdfPaidOrder {
  shopOrderId: number;
  status: VdfOrderStatus;
  employeeName: string;
  executedByName: string | null;
  amount: number;
  payments: Array<{
    paidByName: string | null;
    cashTransaction: { amount: number; date: Date; person: string | null };
  }>;
}

/**
 * Оплаты заказа для магазина — по одной на расход в кассе. Удалённый расход оплатой уже не считается.
 * remaining — сколько по заказу осталось оплатить (у исполненного — ноль)
 */
export function vdfPayments(order: VdfPaidOrder) {
  const remaining = order.status === 'EXECUTED' ? 0 : vdfRemaining(order.amount, vdfPaidTotal(order.payments));
  return order.payments.map(({ paidByName, cashTransaction: tx }) => ({
    orderId: order.shopOrderId,
    employeeName: order.employeeName,
    amount: tx.amount,
    paidAt: tx.date.toISOString(),
    person: tx.person ?? paidByName ?? order.executedByName ?? '',
    remaining,
  }));
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
