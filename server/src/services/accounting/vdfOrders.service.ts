import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import type { AuthPayload } from '../../middleware/auth.middleware';
import { expensesService } from '../expenses.service';
import { planVdfOrder, vdfExpenseDescription } from './vdfOrders.logic';

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
 */
export const vdfOrdersService = {
  async receive(report: VdfOrderReport) {
    const current = await prisma.vdfOrder.findUnique({ where: { shopOrderId: report.orderId } });
    const plan = planVdfOrder(current, report.done);

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
            data: { ...details, ...(!plan.keepAmount && { amount: report.total }) },
          });
        }
        return plan.action;
      }
      case 'markCancelled':
        await prisma.vdfOrder.update({ where: { shopOrderId: report.orderId }, data: { shopCancelled: plan.cancelled } });
        return plan.action;
      case 'delete':
        // Условие по статусу: если заказ успели исполнить, он остаётся
        await prisma.vdfOrder.deleteMany({ where: { shopOrderId: report.orderId, status: 'PENDING' } });
        return plan.action;
      default:
        return plan.action;
    }
  },

  async list(status: 'PENDING' | 'EXECUTED') {
    return prisma.vdfOrder.findMany({
      where: { status },
      orderBy: status === 'PENDING' ? { completedAt: 'asc' } : { executedAt: 'desc' },
      take: status === 'PENDING' ? undefined : 200,
      include: { cashTransaction: { select: { id: true, person: true, date: true } } },
    });
  },

  async pendingCount() {
    return prisma.vdfOrder.count({ where: { status: 'PENDING' } });
  },

  async updateAmount(id: string, amount: number) {
    const updated = await prisma.vdfOrder.updateMany({
      where: { id, status: 'PENDING' },
      data: { amount, amountEdited: true },
    });
    if (!updated.count) throw await notPendingError(id);
    return prisma.vdfOrder.findUniqueOrThrow({ where: { id } });
  },

  /** Исполнить: расход в кассе на сумму заказа сегодняшним днём и отметка заказа — одной транзакцией */
  async execute(id: string, person: string, executor: AuthPayload) {
    return prisma.$transaction(async tx => {
      const order = await tx.vdfOrder.findUnique({ where: { id } });
      if (!order) throw new AppError('Заказ не найден', 404);
      if (order.status !== 'PENDING') throw new AppError('Заказ уже исполнен', 400);
      if (!(order.amount > 0)) throw new AppError('Сумма должна быть больше нуля', 400);

      const expenseCategoryId = await expensesService.resolveCategoryId(VDF_EXPENSE_CATEGORY, tx);
      const expense = await tx.cashTransaction.create({
        data: {
          type: 'EXPENSE',
          date: new Date(),
          description: vdfExpenseDescription(order.shopOrderId, order.employeeName),
          amount: order.amount,
          person,
          expenseCategoryId,
        },
      });
      // Условие по статусу — защита от двойного нажатия: второй расход по тому же заказу не пройдёт
      const updated = await tx.vdfOrder.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'EXECUTED', executedAt: new Date(), executedByName: executor.name, cashTransactionId: expense.id },
      });
      if (!updated.count) throw new AppError('Заказ уже исполнен', 400);
      return tx.vdfOrder.findUniqueOrThrow({ where: { id } });
    });
  },
};

async function notPendingError(id: string) {
  const exists = await prisma.vdfOrder.findUnique({ where: { id }, select: { id: true } });
  return exists ? new AppError('Сумму исполненного заказа не меняют', 400) : new AppError('Заказ не найден', 404);
}
