import { prisma } from '../../prisma/client';
import { Currency } from '../currency.service';
import { capitalAmountFields } from '../currencyAccounting.service';
import { roundMoney } from './shared';

/** Капитал: пополнения и выдачи в BYN/USD/EUR */
export const capitalService = {
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
    let eur = 0;
    for (const r of rows) {
      const sign = r.type === 'DEPOSIT' ? 1 : -1;
      if (r.amountByn != null) byn += sign * r.amountByn;
      if (r.amountUsd != null) usd += sign * r.amountUsd;
      if (r.amountEur != null) eur += sign * r.amountEur;
    }
    return { byn: roundMoney(byn), usd: roundMoney(usd), eur: roundMoney(eur) };
  },

  async createDeposit(data: { date: string; amount: number; currency: Currency }) {
    return prisma.capitalTransaction.create({
      data: {
        type: 'DEPOSIT',
        date: new Date(data.date),
        ...capitalAmountFields(data.currency, data.amount),
      },
    });
  },

  async createWithdrawal(data: { date: string; amount: number; currency: Currency; description?: string; person: string }) {
    return prisma.capitalTransaction.create({
      data: {
        type: 'WITHDRAWAL',
        date: new Date(data.date),
        ...capitalAmountFields(data.currency, data.amount),
        description: data.description,
        person: data.person,
      },
    });
  },
};
