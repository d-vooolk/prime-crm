import { Request, Response } from 'express';
import { z } from 'zod';
import { accountingService } from '../services/accounting.service';
import { AppError } from '../middleware/errorHandler';

// Выплачивать ЗП могут все роли выше «Сотрудника»
const PAYROLL_ROLES = ['Создатель', 'Директор', 'Менеджер'];

const assertCanPaySalary = (req: Request) => {
  if (!req.user?.isMaster && !PAYROLL_ROLES.includes(req.user?.role || '')) {
    throw new AppError('Недостаточно прав', 403);
  }
};

const salaryPaymentSchema = z.object({
  servicemanName: z.string().min(1, 'Выберите сотрудника'),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().positive('Сумма должна быть больше нуля'),
  cardAmount: z.coerce.number().min(0).default(0),
  date: z.string().min(1),
  person: z.string().optional(),
}).refine(d => d.cardAmount <= d.amount, { message: 'Сумма на карту больше суммы выплаты', path: ['cardAmount'] });

export const accountingController = {
  async getCash(req: Request, res: Response) {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const data = await accountingService.getCashForMonth(year, month);
    res.json({ data });
  },

  async getBalance(_req: Request, res: Response) {
    const balance = await accountingService.getBalance();
    res.json({ data: { balance } });
  },

  async createExpense(req: Request, res: Response) {
    const { date, description, amount, person, founderSalary } = req.body;
    const tx = await accountingService.createExpense({
      date,
      description,
      amount,
      person,
      founderSalary: founderSalary
        ? { year: Number(founderSalary.year), month: Number(founderSalary.month), person: founderSalary.person }
        : undefined,
    });
    res.status(201).json({ data: tx });
  },

  async createManualIncome(req: Request, res: Response) {
    const { date, description, amount, person } = req.body;
    const tx = await accountingService.createManualIncome({ date, description, amount, person });
    res.status(201).json({ data: tx });
  },

  async getCapital(_req: Request, res: Response) {
    const data = await accountingService.getCapital();
    res.json({ data });
  },

  async getCapitalBalance(_req: Request, res: Response) {
    const data = await accountingService.getCapitalBalance();
    res.json({ data });
  },

  async createDeposit(req: Request, res: Response) {
    const { date, amount, currency } = req.body;
    const tx = await accountingService.createDeposit({ date, amount, currency });
    res.status(201).json({ data: tx });
  },

  async createWithdrawal(req: Request, res: Response) {
    const { date, amount, currency, description, person } = req.body;
    const tx = await accountingService.createWithdrawal({ date, amount, currency, description, person });
    res.status(201).json({ data: tx });
  },

  async getSalary(req: Request, res: Response) {
    const servicemanName = String(req.query.servicemanName || '');
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const data = await accountingService.getSalaryData(servicemanName, year, month);
    res.json({ data });
  },

  async updateCashTransaction(req: Request, res: Response) {
    const id = String(req.params.id);
    const { date, amount, description, person } = req.body;
    const tx = await accountingService.updateCashTransaction(id, { date, amount, description, person });
    res.json({ data: tx });
  },

  async deleteCashTransaction(req: Request, res: Response) {
    const id = String(req.params.id);
    await accountingService.deleteCashTransaction(id);
    res.status(204).end();
  },

  async getMonthlyRevenue(_req: Request, res: Response) {
    const data = await accountingService.getMonthlyRevenue();
    res.json({ data });
  },

  async setMonthlyRevenue(req: Request, res: Response) {
    const { year, month, amount } = req.body;
    const data = await accountingService.setMonthlyRevenue(Number(year), Number(month), Number(amount));
    res.json({ data });
  },

  async getMonthlyRecordCount(_req: Request, res: Response) {
    const data = await accountingService.getMonthlyRecordCount();
    res.json({ data });
  },

  async setMonthlyRecordCount(req: Request, res: Response) {
    const { year, month, count } = req.body;
    const data = await accountingService.setMonthlyRecordCount(Number(year), Number(month), Number(count));
    res.json({ data });
  },

  async getSalaryHistory(req: Request, res: Response) {
    const servicemanName = String(req.query.servicemanName || '');
    const data = await accountingService.getSalaryHistory(servicemanName);
    res.json({ data });
  },

  async createAdjustment(req: Request, res: Response) {
    const { servicemanName, type, amount, reason, year, month } = req.body;
    const adj = await accountingService.createAdjustment({ servicemanName, type, amount: Number(amount), reason, year: Number(year), month: Number(month) });
    res.status(201).json({ data: adj });
  },

  async deleteAdjustment(req: Request, res: Response) {
    const id = String(req.params.id);
    await accountingService.deleteAdjustment(id);
    res.status(204).end();
  },

  async createSalaryPayment(req: Request, res: Response) {
    assertCanPaySalary(req);
    const result = salaryPaymentSchema.safeParse(req.body);
    if (!result.success) throw new AppError('Ошибка валидации', 400, result.error.flatten());
    const tx = await accountingService.createSalaryPayment(result.data);
    res.status(201).json({ data: tx });
  },

  async deleteSalaryPayment(req: Request, res: Response) {
    assertCanPaySalary(req);
    await accountingService.deleteSalaryPayment(String(req.params.id));
    res.status(204).end();
  },

  async getFounderSalaries(_req: Request, res: Response) {
    const records = await accountingService.getFounderSalaries();
    res.json({ data: records });
  },

  async getDebts(req: Request, res: Response) {
    const archived = String(req.query.archived || 'false') === 'true';
    const data = await accountingService.getDebts(archived);
    res.json({ data });
  },

  async createDebt(req: Request, res: Response) {
    const { description, amount, direction } = req.body;
    const debt = await accountingService.createDebt({
      description: String(description || '').trim(),
      amount: Number(amount),
      direction: direction === 'OWED_TO_US' ? 'OWED_TO_US' : 'WE_OWE',
    });
    res.status(201).json({ data: debt });
  },

  async updateDebt(req: Request, res: Response) {
    const id = String(req.params.id);
    const { description, amount } = req.body;
    const debt = await accountingService.updateDebt(id, {
      ...(description !== undefined && { description: String(description) }),
      ...(amount !== undefined && { amount: Number(amount) }),
    });
    res.json({ data: debt });
  },

  async deleteDebt(req: Request, res: Response) {
    const id = String(req.params.id);
    await accountingService.deleteDebt(id);
    res.status(204).end();
  },

  async payDebt(req: Request, res: Response) {
    const id = String(req.params.id);
    const { amount } = req.body;
    const debt = await accountingService.payDebt(id, Number(amount), req.user?.name);
    res.status(201).json({ data: debt });
  },
};
