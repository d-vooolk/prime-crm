import { Request, Response } from 'express';
import { z } from 'zod';
import { vdfOrdersService } from '../services/accounting/vdfOrders.service';
import { parse, positiveMoney, money, dateString, requiredText, optionalText, id } from '../middleware/validate';

const itemSchema = z.object({
  title: z.string().trim().max(500),
  options: z.string().trim().max(500).default(''),
  sku: z.string().trim().max(100).nullable().default(null),
  qty: z.coerce.number().int().positive().max(100000),
  price: money(),
  sum: money(),
});

const orderId = z.coerce.number().int().positive();

const reportSchema = z.discriminatedUnion('done', [
  z.object({
    orderId,
    done: z.literal(true),
    employeeName: requiredText(150, 'Нет имени сотрудника'),
    employeePhone: optionalText(50),
    items: z.array(itemSchema).max(500),
    total: money(),
    completedAt: dateString(),
  }),
  z.object({ orderId, done: z.literal(false) }),
]);

const statusSchema = z.object({ status: z.enum(['PENDING', 'EXECUTED', 'CANCELLED']).default('PENDING') });
const amountSchema = z.object({ amount: positiveMoney() });
// Без суммы — исполнить на весь остаток
const executeSchema = z.object({
  person: requiredText(150, 'Выберите изымателя'),
  amount: positiveMoney().optional(),
});
const cancelSchema = z.object({ reason: optionalText(300) });

export const vdfOrdersController = {
  /** Магазин присылает состояние заказа сотрудника (вход по ключу, а не по токену пользователя) */
  async receive(req: Request, res: Response) {
    const report = parse(reportSchema, req.body);
    res.json({ data: { result: await vdfOrdersService.receive(report) } });
  },

  /** Магазин забирает оплаченные и отменённые заказы для своей бухгалтерии (вход по ключу) */
  async states(_req: Request, res: Response) {
    res.json({ data: await vdfOrdersService.states() });
  },

  async list(req: Request, res: Response) {
    const { status } = parse(statusSchema, req.query);
    res.json({ data: await vdfOrdersService.list(status) });
  },

  async pendingCount(_req: Request, res: Response) {
    res.json({ data: { count: await vdfOrdersService.pendingCount() } });
  },

  async updateAmount(req: Request, res: Response) {
    const { amount } = parse(amountSchema, req.body);
    res.json({ data: await vdfOrdersService.updateAmount(parse(id, req.params.id), amount) });
  },

  async cancel(req: Request, res: Response) {
    const { reason } = parse(cancelSchema, req.body ?? {});
    res.json({ data: await vdfOrdersService.cancel(parse(id, req.params.id), reason, req.user!) });
  },

  async restore(req: Request, res: Response) {
    res.json({ data: await vdfOrdersService.restore(parse(id, req.params.id)) });
  },

  async execute(req: Request, res: Response) {
    const { person, amount } = parse(executeSchema, req.body);
    res.json({ data: await vdfOrdersService.execute(parse(id, req.params.id), person, amount, req.user!) });
  },
};
