import { Request, Response } from 'express';
import { z } from 'zod';
import { cashService } from '../services/accounting/cash.service';
import { capitalService } from '../services/accounting/capital.service';
import { salaryService } from '../services/accounting/salary.service';
import { statsService } from '../services/accounting/stats.service';
import { debtsService } from '../services/accounting/debts.service';
import { parseExpenseCategoryField } from './expenses.controller';
import { AppError } from '../middleware/errorHandler';
import { parse, positiveMoney, money, dateString, requiredText, optionalText } from '../middleware/validate';
import { currencyService } from '../services/currency.service';
import { currencyAccountingService } from '../services/currencyAccounting.service';
import { hasRole, ROLES } from '../utils/roles';

const currencySchema = z.enum(['BYN', 'USD', 'EUR'], { errorMap: () => ({ message: 'Неизвестная валюта' }) });
const yearSchema = z.coerce.number().int().min(2000).max(2100);
const monthSchema = z.coerce.number().int().min(1, 'Некорректный месяц').max(12, 'Некорректный месяц');

const expenseSchema = z.object({
  date: dateString(),
  description: requiredText(500, 'Укажите цель расхода'),
  amount: positiveMoney(),
  person: requiredText(150, 'Выберите изымателя'),
  founderSalary: z.object({
    year: yearSchema,
    month: monthSchema,
    person: requiredText(150, 'Выберите учредителя'),
  }).optional(),
});

const manualIncomeSchema = z.object({
  date: dateString(),
  description: requiredText(500, 'Укажите описание'),
  amount: positiveMoney(),
  person: requiredText(150, 'Выберите, кто вносит'),
});

const cashUpdateSchema = z.object({
  date: dateString().optional(),
  amount: positiveMoney().optional(),
  description: z.string().trim().max(500).optional(),
  person: z.string().trim().max(150).optional(),
});

const depositSchema = z.object({
  date: dateString(),
  amount: positiveMoney(),
  currency: currencySchema,
});

const withdrawalSchema = depositSchema.extend({
  description: optionalText(500),
  person: requiredText(150, 'Выберите, кто забирает'),
});

const capitalTransferSchema = z.object({
  date: dateString(),
  amountByn: positiveMoney(),
  currency: currencySchema,
  currencyAmount: positiveMoney().optional(),
  person: requiredText(150, 'Выберите, кто отчисляет'),
  description: optionalText(500),
}).refine(d => d.currency === 'BYN' || d.currencyAmount != null, {
  message: 'Укажите сумму в валюте', path: ['currencyAmount'],
});

const salaryQuerySchema = z.object({
  servicemanName: requiredText(150, 'Не выбран сотрудник'),
  year: yearSchema.optional(),
  month: monthSchema.optional(),
});

const adjustmentSchema = z.object({
  servicemanName: requiredText(150, 'Не выбран сотрудник'),
  type: z.enum(['FINE', 'BONUS']),
  amount: positiveMoney(),
  reason: requiredText(500, 'Укажите причину'),
  year: yearSchema,
  month: monthSchema,
});

const salaryPaymentSchema = z.object({
  servicemanName: requiredText(150, 'Выберите сотрудника'),
  year: yearSchema,
  month: monthSchema,
  amount: positiveMoney(),
  cardAmount: money().default(0),
  date: dateString(),
  person: optionalText(150),
}).refine(d => d.cardAmount <= d.amount, { message: 'Сумма на карту больше суммы выплаты', path: ['cardAmount'] });

const monthlyRevenueSchema = z.object({ year: yearSchema, month: monthSchema, amount: money() });
const monthlyCountSchema = z.object({ year: yearSchema, month: monthSchema, count: z.coerce.number().int().min(0) });

const debtCreateSchema = z.object({
  description: requiredText(500, 'Укажите, за что долг'),
  amount: positiveMoney('Сумма долга должна быть больше нуля'),
  currency: currencySchema.default('BYN'),
  direction: z.enum(['WE_OWE', 'OWED_TO_US']).default('WE_OWE'),
});

const debtUpdateSchema = z.object({
  description: requiredText(500, 'Укажите, за что долг').optional(),
  amount: positiveMoney('Сумма долга должна быть больше нуля').optional(),
});

const debtPaymentSchema = z.object({
  amount: positiveMoney('Сумма погашения должна быть больше нуля'),
  currency: currencySchema.optional(),
  rate: z.coerce.number().positive().finite().optional(),
});

/** Сотрудник видит только свою зарплату, менеджеры и выше — любую */
function assertCanSeeSalaryOf(req: Request, servicemanName: string) {
  if (!hasRole(req.user, ROLES.MANAGER) && req.user?.name !== servicemanName) {
    throw new AppError('Недостаточно прав', 403);
  }
}

export const accountingController = {
  // ─── Касса ──────────────────────────────────────────
  async getCash(req: Request, res: Response) {
    const now = new Date();
    const { year = now.getFullYear(), month = now.getMonth() + 1 } = parse(
      z.object({ year: yearSchema.optional(), month: monthSchema.optional() }), req.query,
    );
    res.json({ data: await cashService.getCashForMonth(year, month) });
  },

  async getBalance(_req: Request, res: Response) {
    res.json({ data: { balance: await cashService.getBalance() } });
  },

  async createExpense(req: Request, res: Response) {
    const data = parse(expenseSchema, req.body);
    const tx = await cashService.createExpense({ ...data, expenseCategory: parseExpenseCategoryField(req.body.expenseCategory) });
    res.status(201).json({ data: tx });
  },

  async createManualIncome(req: Request, res: Response) {
    const data = parse(manualIncomeSchema, req.body);
    res.status(201).json({ data: await cashService.createManualIncome(data) });
  },

  async updateCashTransaction(req: Request, res: Response) {
    const data = parse(cashUpdateSchema, req.body);
    const tx = await cashService.updateCashTransaction(String(req.params.id), {
      ...data,
      expenseCategory: parseExpenseCategoryField(req.body.expenseCategory),
    });
    res.json({ data: tx });
  },

  async deleteCashTransaction(req: Request, res: Response) {
    await cashService.deleteCashTransaction(String(req.params.id));
    res.status(204).end();
  },

  // ─── Капитал ────────────────────────────────────────
  async getCapital(_req: Request, res: Response) {
    res.json({ data: await capitalService.getCapital() });
  },

  async getCapitalBalance(_req: Request, res: Response) {
    res.json({ data: await capitalService.getCapitalBalance() });
  },

  async createDeposit(req: Request, res: Response) {
    const data = parse(depositSchema, req.body);
    res.status(201).json({ data: await capitalService.createDeposit(data) });
  },

  async createWithdrawal(req: Request, res: Response) {
    const data = parse(withdrawalSchema, req.body);
    res.status(201).json({ data: await capitalService.createWithdrawal(data) });
  },

  async createCapitalTransfer(req: Request, res: Response) {
    const data = parse(capitalTransferSchema, req.body);
    res.status(201).json({ data: await currencyAccountingService.createCapitalTransfer(data) });
  },

  async getRates(req: Request, res: Response) {
    res.json({ data: await currencyService.getRates(req.query.refresh === 'true') });
  },

  // ─── Зарплата ───────────────────────────────────────
  async getSalary(req: Request, res: Response) {
    const now = new Date();
    const { servicemanName, year = now.getFullYear(), month = now.getMonth() + 1 } = parse(salaryQuerySchema, req.query);
    assertCanSeeSalaryOf(req, servicemanName);
    res.json({ data: await salaryService.getSalaryData(servicemanName, year, month) });
  },

  async getSalaryHistory(req: Request, res: Response) {
    const { servicemanName } = parse(salaryQuerySchema, req.query);
    assertCanSeeSalaryOf(req, servicemanName);
    res.json({ data: await salaryService.getSalaryHistory(servicemanName) });
  },

  async createAdjustment(req: Request, res: Response) {
    const data = parse(adjustmentSchema, req.body);
    res.status(201).json({ data: await salaryService.createAdjustment(data) });
  },

  async deleteAdjustment(req: Request, res: Response) {
    await salaryService.deleteAdjustment(String(req.params.id));
    res.status(204).end();
  },

  async createSalaryPayment(req: Request, res: Response) {
    const data = parse(salaryPaymentSchema, req.body);
    res.status(201).json({ data: await salaryService.createSalaryPayment(data) });
  },

  async deleteSalaryPayment(req: Request, res: Response) {
    await salaryService.deleteSalaryPayment(String(req.params.id));
    res.status(204).end();
  },

  async getFounderSalaries(_req: Request, res: Response) {
    res.json({ data: await salaryService.getFounderSalaries() });
  },

  // ─── Статистика по месяцам ──────────────────────────
  async getMonthlyRevenue(_req: Request, res: Response) {
    res.json({ data: await statsService.getMonthlyRevenue() });
  },

  async setMonthlyRevenue(req: Request, res: Response) {
    const { year, month, amount } = parse(monthlyRevenueSchema, req.body);
    res.json({ data: await statsService.setMonthlyRevenue(year, month, amount) });
  },

  async getMonthlyRecordCount(_req: Request, res: Response) {
    res.json({ data: await statsService.getMonthlyRecordCount() });
  },

  async setMonthlyRecordCount(req: Request, res: Response) {
    const { year, month, count } = parse(monthlyCountSchema, req.body);
    res.json({ data: await statsService.setMonthlyRecordCount(year, month, count) });
  },

  // ─── Долги ──────────────────────────────────────────
  async getDebts(req: Request, res: Response) {
    const archived = String(req.query.archived || 'false') === 'true';
    res.json({ data: await debtsService.getDebts(archived) });
  },

  async createDebt(req: Request, res: Response) {
    const data = parse(debtCreateSchema, req.body);
    const debt = await debtsService.createDebt({ ...data, expenseCategory: parseExpenseCategoryField(req.body.expenseCategory) });
    res.status(201).json({ data: debt });
  },

  async updateDebt(req: Request, res: Response) {
    const data = parse(debtUpdateSchema, req.body);
    const debt = await debtsService.updateDebt(String(req.params.id), {
      ...data,
      expenseCategory: parseExpenseCategoryField(req.body.expenseCategory),
    });
    res.json({ data: debt });
  },

  async deleteDebt(req: Request, res: Response) {
    await debtsService.deleteDebt(String(req.params.id));
    res.status(204).end();
  },

  async payDebt(req: Request, res: Response) {
    const data = parse(debtPaymentSchema, req.body);
    res.status(201).json({ data: await debtsService.payDebt(String(req.params.id), data, req.user?.name) });
  },
};
