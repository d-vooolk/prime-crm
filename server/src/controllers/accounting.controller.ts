import { Request, Response } from 'express';
import { accountingService } from '../services/accounting.service';

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
    const { date, description, amount, person } = req.body;
    const tx = await accountingService.createExpense({ date, description, amount, person });
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
    const { date, amount, currency, person } = req.body;
    const tx = await accountingService.createWithdrawal({ date, amount, currency, person });
    res.status(201).json({ data: tx });
  },
};
