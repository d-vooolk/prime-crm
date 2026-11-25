import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { Currency } from '../currency.service';
import { capitalAmountFields } from '../currencyAccounting.service';
import { roundMoney } from './shared';

/** Капитал: пополнения и выдачи в BYN/USD/EUR */
export const capitalService = {
  async getCapital() {
    const rows = await prisma.capitalTransaction.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
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

  /**
   * Правка операции капитала (только Создатель). Меняется лишь сама строка капитала:
   * связанный расход кассы «Отчисление в капитал», погашение долга и т. п. остаются как были.
   * Сумма пишется в ту же валюту, в которой операция была.
   */
  async updateTransaction(id: string, data: { date?: string; amount?: number; description?: string | null; person?: string | null }) {
    const current = await prisma.capitalTransaction.findUnique({ where: { id } });
    if (!current) throw new AppError('Операция не найдена', 404);
    const currency: Currency = current.amountUsd != null ? 'USD' : current.amountEur != null ? 'EUR' : 'BYN';
    if (current.type === 'WITHDRAWAL' && data.person === null) throw new AppError('Выберите, кто забирает', 400);
    return prisma.capitalTransaction.update({
      where: { id },
      data: {
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.amount !== undefined && {
          amountByn: currency === 'BYN' ? data.amount : null,
          amountUsd: currency === 'USD' ? data.amount : null,
          amountEur: currency === 'EUR' ? data.amount : null,
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.person !== undefined && { person: data.person }),
      },
    });
  },

  /** Удаление операции капитала (только Создатель) — касса и долги не меняются */
  async deleteTransaction(id: string) {
    const { count } = await prisma.capitalTransaction.deleteMany({ where: { id } });
    if (!count) throw new AppError('Операция не найдена', 404);
  },
};
