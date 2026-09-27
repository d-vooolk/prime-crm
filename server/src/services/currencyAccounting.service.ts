import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ForeignCurrency, Currency, isForeignCurrency, assertRate, roundMoney, toByn } from './currency.service';

type Db = Prisma.TransactionClient | typeof prisma;

/** Часть оплаты в валюте: сумма в BYN = amount × rate */
export interface CurrencyPart {
  currency: ForeignCurrency;
  amount: number;
  rate: number;
}

export const CAPITAL_TRANSFER_PREFIX = 'Отчисление в капитал';

const round4 = (v: number) => Math.round(v * 10000) / 10000;

export const formatCurrencyAmount = (amount: number, currency: Currency) =>
  `${roundMoney(amount).toLocaleString('ru-RU')} ${currency}`;

/** Сумма в валюте капитала — в своё поле */
export const capitalAmountFields = (currency: Currency, amount: number) => ({
  amountByn: currency === 'BYN' ? amount : undefined,
  amountUsd: currency === 'USD' ? amount : undefined,
  amountEur: currency === 'EUR' ? amount : undefined,
});

export function parseCurrencyParts(raw: unknown): CurrencyPart[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new AppError('Некорректная оплата в валюте', 400);
  return raw.map((p: { currency?: unknown; amount?: unknown; rate?: unknown }) => {
    if (!isForeignCurrency(p?.currency)) throw new AppError('Неизвестная валюта', 400);
    if (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0) {
      throw new AppError('Сумма в валюте должна быть больше нуля', 400);
    }
    assertRate(p.rate);
    return { currency: p.currency, amount: roundMoney(p.amount), rate: round4(p.rate) };
  });
}

export const currencyPartsByn = (parts: CurrencyPart[]) =>
  roundMoney(parts.reduce((s, p) => s + toByn(p.amount, p.rate), 0));

export const currencyAccountingService = {
  /**
   * Валюта, полученная от клиента (или по долгу), сразу уходит в капитал, но в кассе остаётся след:
   * приход на сумму в BYN по курсу → расход «Отчисление в капитал» на ту же сумму → пополнение капитала
   * в исходной валюте. Касса в итоге не меняется. Расход и пополнение удаляются вместе с приходом.
   */
  async createCurrencyIncome(db: Db, data: {
    part: CurrencyPart;
    date: Date;
    description: string;
    person?: string | null;
    recordId?: string;
    isPrepayment?: boolean;
    clientName?: string;
    clientPhone?: string;
    carInfo?: string;
  }) {
    const { part } = data;
    const amountByn = toByn(part.amount, part.rate);
    const common = {
      date: data.date,
      person: data.person ?? null,
      recordId: data.recordId,
      isPrepayment: data.isPrepayment ?? false,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      carInfo: data.carInfo,
    };
    const rateText = `${formatCurrencyAmount(part.amount, part.currency)} по курсу ${part.rate}`;

    const income = await db.cashTransaction.create({
      data: {
        ...common,
        type: 'INCOME',
        amount: amountByn,
        description: `${data.description} (${rateText})`,
        currency: part.currency,
        currencyAmount: part.amount,
        currencyRate: part.rate,
      },
    });
    await db.cashTransaction.create({
      data: {
        ...common,
        type: 'EXPENSE',
        amount: amountByn,
        description: `${CAPITAL_TRANSFER_PREFIX}: ${rateText}`,
        linkedIncomeId: income.id,
        capitalTransfer: {
          create: {
            type: 'DEPOSIT',
            date: data.date,
            ...capitalAmountFields(part.currency, part.amount),
            rate: part.rate,
            person: data.person ?? null,
            description: data.description,
          },
        },
      },
    });
    return income;
  },

  /**
   * Кнопка «Отчисление в капитал» в расходах: из кассы уходит amountByn, в капитал приходит
   * либо та же сумма в BYN, либо купленная на неё валюта (currencyAmount).
   */
  async createCapitalTransfer(data: {
    date: string;
    amountByn: number;
    currency: Currency;
    currencyAmount?: number;
    person: string;
    description?: string;
  }) {
    if (!Number.isFinite(data.amountByn) || data.amountByn <= 0) {
      throw new AppError('Сумма отчисления должна быть больше нуля', 400);
    }
    if (!data.person) throw new AppError('Выберите, кто отчисляет', 400);
    const amountByn = roundMoney(data.amountByn);
    const date = new Date(data.date);

    let capitalAmount = amountByn;
    let rate: number | null = null;
    if (data.currency !== 'BYN') {
      if (!isForeignCurrency(data.currency)) throw new AppError('Неизвестная валюта', 400);
      if (!data.currencyAmount || !Number.isFinite(data.currencyAmount) || data.currencyAmount <= 0) {
        throw new AppError('Укажите сумму в валюте', 400);
      }
      capitalAmount = roundMoney(data.currencyAmount);
      rate = round4(amountByn / capitalAmount);
    }

    const note = data.description?.trim();
    const what = data.currency === 'BYN'
      ? formatCurrencyAmount(amountByn, 'BYN')
      : `${formatCurrencyAmount(capitalAmount, data.currency)} по курсу ${rate}`;
    return prisma.cashTransaction.create({
      data: {
        type: 'EXPENSE',
        date,
        amount: amountByn,
        person: data.person,
        description: `${CAPITAL_TRANSFER_PREFIX}: ${what}${note ? ` — ${note}` : ''}`,
        capitalTransfer: {
          create: {
            type: 'DEPOSIT',
            date,
            ...capitalAmountFields(data.currency, capitalAmount),
            rate,
            person: data.person,
            description: note || CAPITAL_TRANSFER_PREFIX,
          },
        },
      },
    });
  },
};
