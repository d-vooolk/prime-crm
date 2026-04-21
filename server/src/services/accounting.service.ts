import { prisma } from '../prisma/client';

export const accountingService = {
  async getCashForMonth(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const rows = await prisma.cashTransaction.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
    });
    return {
      income: rows.filter(r => r.type === 'INCOME' || r.type === 'MANUAL_INCOME'),
      incomeRs: rows.filter(r => r.type === 'INCOME_RS'),
      expenses: rows.filter(r => r.type === 'EXPENSE'),
    };
  },

  async getBalance() {
    const rows = await prisma.cashTransaction.findMany({
      where: { type: { in: ['INCOME', 'MANUAL_INCOME', 'EXPENSE'] } },
    });
    return rows.reduce((s, r) => {
      if (r.type === 'EXPENSE') return s - r.amount;
      return s + r.amount;
    }, 0);
  },

  async createExpense(data: { date: string; description: string; amount: number; person: string }) {
    return prisma.cashTransaction.create({
      data: { type: 'EXPENSE', date: new Date(data.date), description: data.description, amount: data.amount, person: data.person },
    });
  },

  async createManualIncome(data: { date: string; description: string; amount: number; person: string }) {
    return prisma.cashTransaction.create({
      data: { type: 'MANUAL_INCOME', date: new Date(data.date), description: data.description, amount: data.amount, person: data.person },
    });
  },

  async createIncomeFromDeal(data: {
    recordId: string;
    clientName: string;
    clientPhone: string;
    carInfo: string;
    amount: number;
    isPaidByBankTransfer: boolean;
    closedAt: Date;
  }) {
    return prisma.cashTransaction.create({
      data: {
        type: data.isPaidByBankTransfer ? 'INCOME_RS' : 'INCOME',
        date: data.closedAt,
        amount: data.amount,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        carInfo: data.carInfo,
        recordId: data.recordId,
      },
    });
  },

  async getCapital() {
    const rows = await prisma.capitalTransaction.findMany({ orderBy: { date: 'asc' } });
    return {
      deposits: rows.filter(r => r.type === 'DEPOSIT'),
      withdrawals: rows.filter(r => r.type === 'WITHDRAWAL'),
    };
  },

  async getCapitalBalance() {
    const rows = await prisma.capitalTransaction.findMany();
    let byn = 0;
    let usd = 0;
    for (const r of rows) {
      const sign = r.type === 'DEPOSIT' ? 1 : -1;
      if (r.amountByn != null) byn += sign * r.amountByn;
      if (r.amountUsd != null) usd += sign * r.amountUsd;
    }
    return { byn, usd };
  },

  async createDeposit(data: { date: string; amount: number; currency: 'BYN' | 'USD' }) {
    return prisma.capitalTransaction.create({
      data: {
        type: 'DEPOSIT',
        date: new Date(data.date),
        amountByn: data.currency === 'BYN' ? data.amount : undefined,
        amountUsd: data.currency === 'USD' ? data.amount : undefined,
      },
    });
  },

  async createWithdrawal(data: { date: string; amount: number; currency: 'BYN' | 'USD'; person: string }) {
    return prisma.capitalTransaction.create({
      data: {
        type: 'WITHDRAWAL',
        date: new Date(data.date),
        amountByn: data.currency === 'BYN' ? data.amount : undefined,
        amountUsd: data.currency === 'USD' ? data.amount : undefined,
        person: data.person,
      },
    });
  },
};
