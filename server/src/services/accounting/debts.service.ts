import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { expensesService } from '../expenses.service';
import { Currency, isForeignCurrency, assertRate, toByn } from '../currency.service';
import { capitalAmountFields, currencyAccountingService, formatCurrencyAmount } from '../currencyAccounting.service';
import { roundMoney } from './shared';

const DEBT_CATEGORY_SELECT = { select: { id: true, name: true } } as const;

/** Долги: «мы должны» и «нам должны», погашения через кассу или капитал */
export const debtsService = {
  async getDebts(archived: boolean) {
    return prisma.debt.findMany({
      where: { status: archived ? 'SETTLED' : 'ACTIVE' },
      include: { payments: { orderBy: { paidAt: 'asc' } }, expenseCategory: DEBT_CATEGORY_SELECT },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async createDebt(data: {
    description: string; amount: number; currency: Currency; direction: 'WE_OWE' | 'OWED_TO_US'; expenseCategory?: string | null;
  }) {
    if (!data.description) throw new AppError('Укажите, за что долг', 400);
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new AppError('Сумма долга должна быть больше нуля', 400);
    }
    // Категория нужна только нашим долгам — их погашения уходят в расходы
    if (data.direction === 'WE_OWE' && !data.expenseCategory?.trim()) {
      throw new AppError('Укажите категорию долга', 400);
    }
    const expenseCategoryId = data.direction === 'WE_OWE'
      ? await expensesService.resolveCategoryId(data.expenseCategory)
      : null;
    const amount = roundMoney(data.amount);
    return prisma.debt.create({
      data: {
        description: data.description,
        currency: data.currency,
        initialAmount: amount,
        remainingAmount: amount,
        direction: data.direction,
        expenseCategoryId: expenseCategoryId ?? null,
      },
      include: { payments: true, expenseCategory: DEBT_CATEGORY_SELECT },
    });
  },

  async updateDebt(id: string, data: { description?: string; amount?: number; expenseCategory?: string | null }) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    const update: { description?: string; initialAmount?: number; remainingAmount?: number; expenseCategoryId?: string | null } = {};
    if (data.expenseCategory !== undefined && debt.direction === 'WE_OWE') {
      if (!data.expenseCategory?.trim()) throw new AppError('Укажите категорию долга', 400);
      update.expenseCategoryId = await expensesService.resolveCategoryId(data.expenseCategory);
    }
    if (data.description !== undefined) {
      if (!data.description.trim()) throw new AppError('Укажите, за что долг', 400);
      update.description = data.description.trim();
    }
    if (data.amount !== undefined) {
      if (debt.payments.length > 0) {
        throw new AppError('Нельзя менять сумму долга, по которому уже есть погашения', 400);
      }
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new AppError('Сумма долга должна быть больше нуля', 400);
      }
      const amount = roundMoney(data.amount);
      update.initialAmount = amount;
      update.remainingAmount = amount;
    }
    return prisma.debt.update({ where: { id }, data: update, include: { payments: true, expenseCategory: DEBT_CATEGORY_SELECT } });
  },

  async deleteDebt(id: string) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    if (debt.payments.length > 0) {
      throw new AppError('Нельзя удалить долг, по которому есть погашения', 400);
    }
    return prisma.debt.delete({ where: { id } });
  },

  /**
   * Погашение долга. Платить можно в валюте долга или в BYN/валюте по курсу (rate — BYN за 1 единицу валюты).
   * Нам вернули валюту — она через приход в кассе сразу уходит в капитал; мы отдали валюту — она
   * списывается из капитала. Рубли, как и раньше, — приход или расход в кассе.
   */
  async payDebt(id: string, data: { amount: number; currency?: Currency; rate?: number }, person?: string) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    if (debt.status === 'SETTLED') throw new AppError('Долг уже погашен', 400);
    if (!Number.isFinite(data.amount)) throw new AppError('Некорректная сумма погашения', 400);
    const paid = roundMoney(data.amount);
    if (paid <= 0) throw new AppError('Сумма погашения должна быть больше нуля', 400);

    const debtCurrency = debt.currency as Currency;
    const paidCurrency: Currency = data.currency ?? debtCurrency;
    if (paidCurrency !== 'BYN' && !isForeignCurrency(paidCurrency)) throw new AppError('Неизвестная валюта', 400);
    if (paidCurrency !== debtCurrency && paidCurrency !== 'BYN' && debtCurrency !== 'BYN') {
      throw new AppError('Погашайте в валюте долга или в BYN', 400);
    }
    // Курс нужен, если меняется валюта или валюта приходит к нам (приход в кассе — в BYN)
    const needsRate = paidCurrency !== debtCurrency || (paidCurrency !== 'BYN' && debt.direction === 'OWED_TO_US');
    const rate = needsRate ? data.rate : undefined;
    if (needsRate) assertRate(rate);

    let reduce = paid;
    if (paidCurrency !== debtCurrency) {
      reduce = paidCurrency === 'BYN' ? roundMoney(paid / rate!) : toByn(paid, rate!);
    }
    // Копейки от пересчёта по курсу не должны оставлять «хвост» долга
    if (reduce > debt.remainingAmount + 0.01) throw new AppError('Сумма погашения больше остатка долга', 400);
    const newRemaining = Math.max(0, roundMoney(debt.remainingAmount - reduce));
    const willSettle = newRemaining < 0.01;
    const prefix = willSettle ? 'Погашение' : 'Частичное погашение';
    const description = `${prefix} долга — ${debt.description}`;
    const now = new Date();
    const payment = {
      debtId: id,
      amount: willSettle ? debt.remainingAmount : reduce,
      paidCurrency,
      paidAmount: paid,
      rate: rate ?? null,
      paidAt: now,
    };

    return prisma.$transaction(async (tx) => {
      if (paidCurrency === 'BYN') {
        const cashTx = await tx.cashTransaction.create({
          data: {
            type: debt.direction === 'OWED_TO_US' ? 'INCOME' : 'EXPENSE',
            date: now,
            amount: paid,
            description,
            person: person ?? null,
          },
        });
        await tx.debtPayment.create({ data: { ...payment, cashTransactionId: cashTx.id } });
      } else if (debt.direction === 'OWED_TO_US') {
        const income = await currencyAccountingService.createCurrencyIncome(tx, {
          part: { currency: paidCurrency, amount: paid, rate: rate! },
          date: now,
          description,
          person,
        });
        await tx.debtPayment.create({ data: { ...payment, cashTransactionId: income.id } });
      } else {
        const withdrawal = await tx.capitalTransaction.create({
          data: {
            type: 'WITHDRAWAL',
            date: now,
            ...capitalAmountFields(paidCurrency, paid),
            rate: rate ?? null,
            description: `${description} (${formatCurrencyAmount(paid, paidCurrency)})`,
            person: person ?? null,
          },
        });
        await tx.debtPayment.create({ data: { ...payment, capitalTransactionId: withdrawal.id } });
      }

      return tx.debt.update({
        where: { id },
        data: {
          remainingAmount: willSettle ? 0 : newRemaining,
          status: willSettle ? 'SETTLED' : 'ACTIVE',
          settledAt: willSettle ? now : null,
        },
        include: { payments: { orderBy: { paidAt: 'asc' } }, expenseCategory: DEBT_CATEGORY_SELECT },
      });
    });
  },
};
