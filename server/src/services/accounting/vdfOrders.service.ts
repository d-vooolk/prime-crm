import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import type { AuthPayload } from '../../middleware/auth.middleware';
import { expensesService } from '../expenses.service';
import {
  planVdfOrder, planVdfPayment, vdfCancellation, vdfExpenseDescription, vdfNotPendingMessage, vdfPaidTotal,
  vdfPayments, VdfOrderStatus,
} from './vdfOrders.logic';

/** Категория затрат, в которую уходят заказы сотрудников из магазина */
export const VDF_EXPENSE_CATEGORY = 'vdf.by';

export interface VdfOrderItem {
  title: string;
  options: string;
  sku: string | null;
  qty: number;
  price: number;
  sum: number;
}

/** Оплаты заказа: расходы в кассе — сумма, дата и изыматель */
const paymentsInclude = {
  payments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      paidByName: true,
      createdAt: true,
      cashTransaction: { select: { id: true, amount: true, date: true, person: true } },
    },
  },
} satisfies Prisma.VdfOrderInclude;

/** Состояние заказа, которое присылает магазин: выполнен (со всеми данными) или снят с выполнения */
export type VdfOrderReport =
  | {
      orderId: number;
      done: true;
      employeeName: string;
      employeePhone?: string;
      items: VdfOrderItem[];
      total: number;
      completedAt: string;
    }
  | { orderId: number; done: false };

/**
 * Заказы сотрудников из магазина vdf.by: магазин присылает выполненные, администратор
 * проверяет сумму и исполняет — в кассе появляется расход с категорией «vdf.by».
 * Исполнить можно и частично: заказ остаётся в ожидающих с меньшим остатком.
 */
export const vdfOrdersService = {
  async receive(report: VdfOrderReport) {
    const current = await prisma.vdfOrder.findUnique({
      where: { shopOrderId: report.orderId },
      include: { _count: { select: { payments: true } } },
    });
    const plan = planVdfOrder(current && { ...current, paid: current._count.payments > 0 }, report.done);

    switch (plan.action) {
      case 'create':
      case 'refresh': {
        if (!report.done) return plan.action;
        const details = {
          employeeName: report.employeeName,
          employeePhone: report.employeePhone ?? null,
          items: report.items as unknown as Prisma.InputJsonValue,
          shopTotal: report.total,
          completedAt: new Date(report.completedAt),
        };
        if (plan.action === 'create') {
          // Одновременный повтор от магазина упрётся в уникальный shopOrderId — это не ошибка
          await prisma.vdfOrder.upsert({
            where: { shopOrderId: report.orderId },
            create: { shopOrderId: report.orderId, ...details, amount: report.total },
            update: {},
          });
        } else {
          await prisma.vdfOrder.updateMany({
            where: { shopOrderId: report.orderId, status: 'PENDING' },
            data: { ...details, shopCancelled: false, ...(!plan.keepAmount && { amount: report.total }) },
          });
        }
        return plan.action;
      }
      case 'markCancelled':
        await prisma.vdfOrder.update({ where: { shopOrderId: report.orderId }, data: { shopCancelled: plan.cancelled } });
        return plan.action;
      case 'delete':
        // Условия: если заказ успели исполнить или частично оплатить, он остаётся
        await prisma.vdfOrder.deleteMany({
          where: { shopOrderId: report.orderId, status: { in: ['PENDING', 'CANCELLED'] }, payments: { none: {} } },
        });
        return plan.action;
      default:
        return plan.action;
    }
  },

  async list(status: VdfOrderStatus) {
    const orderBy: Prisma.VdfOrderOrderByWithRelationInput = status === 'PENDING'
      ? { completedAt: 'asc' }
      : status === 'EXECUTED' ? { executedAt: 'desc' } : { cancelledAt: 'desc' };
    return prisma.vdfOrder.findMany({
      where: { status },
      orderBy,
      take: status === 'PENDING' ? undefined : 200,
      include: paymentsInclude,
    });
  },

  /**
   * Денежное состояние заказов целиком: оплаты (и частичные, с остатком) и отмены. Магазин сверяет
   * по нему свою бухгалтерию: удалённый из кассы расход снимает оплату, возвращённый из отмены заказ
   * снова ждёт оплаты
   */
  async states() {
    const [paid, cancelled] = await Promise.all([
      prisma.vdfOrder.findMany({
        where: { status: { not: 'CANCELLED' }, payments: { some: {} } },
        orderBy: { shopOrderId: 'asc' },
        select: {
          shopOrderId: true,
          status: true,
          employeeName: true,
          executedByName: true,
          amount: true,
          payments: {
            orderBy: { createdAt: 'asc' },
            select: { paidByName: true, cashTransaction: { select: { amount: true, date: true, person: true } } },
          },
        },
      }),
      prisma.vdfOrder.findMany({
        where: { status: 'CANCELLED' },
        orderBy: { shopOrderId: 'asc' },
        select: { shopOrderId: true, cancelledAt: true, cancelledByName: true, cancelReason: true, updatedAt: true },
      }),
    ]);
    return {
      paid: paid.flatMap(vdfPayments),
      cancelled: cancelled.map(vdfCancellation),
    };
  },

  async pendingCount() {
    return prisma.vdfOrder.count({ where: { status: 'PENDING' } });
  },

  /** Поправить сумму заказа. После частичной оплаты — больше оплаченного: остаток должен остаться */
  async updateAmount(id: string, amount: number) {
    return prisma.$transaction(async tx => {
      const order = await tx.vdfOrder.findUnique({ where: { id }, include: paymentsInclude });
      if (!order) throw new AppError('Заказ не найден', 404);
      if (order.status !== 'PENDING') throw new AppError(vdfNotPendingMessage(order.status), 400);
      const paid = vdfPaidTotal(order.payments);
      if (paid > 0 && amount <= paid) {
        throw new AppError(`Уже оплачено ${paid} р. — сумма должна быть больше`, 400);
      }
      const updated = await tx.vdfOrder.updateMany({
        where: { id, status: 'PENDING', updatedAt: order.updatedAt },
        data: { amount, amountEdited: true },
      });
      if (!updated.count) throw new AppError('Заказ изменился, обновите список', 400);
      return tx.vdfOrder.findUniqueOrThrow({ where: { id }, include: paymentsInclude });
    });
  },

  /**
   * Отменить ожидающий заказ: оплаты не будет. Исполненный и частично оплаченный не отменяют —
   * сначала удаляют его расходы в кассе
   */
  async cancel(id: string, reason: string | undefined, executor: AuthPayload) {
    const updated = await prisma.vdfOrder.updateMany({
      where: { id, status: 'PENDING', payments: { none: {} } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByName: executor.name, cancelReason: reason ?? null },
    });
    if (!updated.count) {
      const paid = await prisma.vdfOrderPayment.count({ where: { orderId: id } });
      throw paid
        ? new AppError('По заказу уже есть оплата — сначала удалите её расход в кассе', 400)
        : await notPendingError(id);
    }
    return prisma.vdfOrder.findUniqueOrThrow({ where: { id } });
  },

  /** Вернуть отменённый заказ в ожидающие */
  async restore(id: string) {
    const updated = await prisma.vdfOrder.updateMany({
      where: { id, status: 'CANCELLED' },
      data: { status: 'PENDING', cancelledAt: null, cancelledByName: null, cancelReason: null },
    });
    if (!updated.count) {
      const exists = await prisma.vdfOrder.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new AppError('Заказ не отменён', 400) : new AppError('Заказ не найден', 404);
    }
    return prisma.vdfOrder.findUniqueOrThrow({ where: { id } });
  },

  /**
   * Исполнить: расход в кассе сегодняшним днём и оплата заказа — одной транзакцией.
   * Без суммы — на весь остаток, и заказ исполнен. С суммой меньше остатка — частичная оплата:
   * заказ остаётся в ожидающих с меньшим остатком, магазин видит «исполнен частично»
   */
  async execute(id: string, person: string, amount: number | undefined, executor: AuthPayload) {
    return prisma.$transaction(async tx => {
      const order = await tx.vdfOrder.findUnique({ where: { id }, include: paymentsInclude });
      if (!order) throw new AppError('Заказ не найден', 404);
      if (order.status !== 'PENDING') throw new AppError(vdfNotPendingMessage(order.status), 400);
      const plan = planVdfPayment(order.amount, vdfPaidTotal(order.payments), amount);
      if (!plan.ok) throw new AppError(plan.message, 400);

      const expenseCategoryId = await expensesService.resolveCategoryId(VDF_EXPENSE_CATEGORY, tx);
      const expense = await tx.cashTransaction.create({
        data: {
          type: 'EXPENSE',
          date: new Date(),
          description: vdfExpenseDescription(order.shopOrderId, order.employeeName),
          amount: plan.amount,
          person,
          expenseCategoryId,
        },
      });
      await tx.vdfOrderPayment.create({
        data: { orderId: id, cashTransactionId: expense.id, paidByName: executor.name },
      });
      // Условие по статусу и времени изменения — защита от двойного нажатия: второй расход не пройдёт
      const updated = await tx.vdfOrder.updateMany({
        where: { id, status: 'PENDING', updatedAt: order.updatedAt },
        data: plan.full
          ? { status: 'EXECUTED', executedAt: new Date(), executedByName: executor.name }
          : { updatedAt: new Date() },
      });
      if (!updated.count) throw new AppError('Заказ изменился, обновите список', 400);
      return tx.vdfOrder.findUniqueOrThrow({ where: { id }, include: paymentsInclude });
    });
  },
};

async function notPendingError(id: string) {
  const order = await prisma.vdfOrder.findUnique({ where: { id }, select: { status: true } });
  return order ? new AppError(vdfNotPendingMessage(order.status), 400) : new AppError('Заказ не найден', 404);
}
