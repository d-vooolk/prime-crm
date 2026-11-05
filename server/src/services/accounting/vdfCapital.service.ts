import { prisma } from '../../prisma/client';
import { ForeignCurrency } from '../currency.service';
import { CAPITAL_TRANSFER_PREFIX, formatCurrencyAmount } from '../currencyAccounting.service';

export interface VdfCapitalDeposit {
  ref: string;
  currency: ForeignCurrency;
  amount: number;
  rate: number;
  date: string;
  description: string;
  person?: string;
}

/**
 * Валюта, которой магазину vdf.by вернули долг: в кассе магазина приход по курсу и тут же
 * «Отчисление в капитал», а сама валюта — пополнением капитала здесь.
 * Повторная отправка того же ref обновляет запись, отзыв — удаляет.
 */
export const vdfCapitalService = {
  async receive(data: VdfCapitalDeposit) {
    const fields = {
      type: 'DEPOSIT' as const,
      date: new Date(data.date),
      amountByn: null,
      amountUsd: data.currency === 'USD' ? data.amount : null,
      amountEur: data.currency === 'EUR' ? data.amount : null,
      rate: data.rate,
      description: `${CAPITAL_TRANSFER_PREFIX} из VDF: ${formatCurrencyAmount(data.amount, data.currency)} по курсу ${data.rate} — ${data.description}`,
      person: data.person ?? null,
    };
    return prisma.capitalTransaction.upsert({
      where: { vdfRef: data.ref },
      create: { ...fields, vdfRef: data.ref },
      update: fields,
    });
  },

  async revoke(ref: string) {
    const { count } = await prisma.capitalTransaction.deleteMany({ where: { vdfRef: ref } });
    return count;
  },
};
