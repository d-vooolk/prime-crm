import { prisma } from '../../prisma/client';
import { MONTH_NAMES, MONTH_NAMES_SHORT } from './shared';

/** Помесячная выручка и число закрытых записей (с ручными поправками за месяц) */
export const statsService = {
  async getMonthlyRevenue() {
    const allTransactions = await prisma.cashTransaction.findMany();
    const calcMap = new Map<string, number>();
    for (const tx of allTransactions) {
      if (tx.type !== 'INCOME' && tx.type !== 'MANUAL_INCOME' && tx.type !== 'INCOME_RS') continue;
      const d = new Date(tx.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      calcMap.set(key, (calcMap.get(key) ?? 0) + tx.amount);
    }

    const overrides = await prisma.monthlyRevenue.findMany();
    const overrideMap = new Map(overrides.map(o => [`${o.year}-${String(o.month).padStart(2, '0')}`, o.amount]));

    const allKeys = new Set([...calcMap.keys(), ...overrideMap.keys()]);

    return Array.from(allKeys)
      .sort((a, b) => (a > b ? -1 : 1))
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        const amount = overrideMap.has(key) ? overrideMap.get(key)! : (calcMap.get(key) ?? 0);
        return {
          key,
          year: y,
          month: m,
          label: `${MONTH_NAMES[m - 1]} ${y}`,
          labelShort: `${MONTH_NAMES_SHORT[m - 1]} ${y}`,
          amount,
          isOverride: overrideMap.has(key),
        };
      });
  },

  async setMonthlyRevenue(year: number, month: number, amount: number) {
    return prisma.monthlyRevenue.upsert({
      where: { year_month: { year, month } },
      update: { amount },
      create: { year, month, amount },
    });
  },

  async getMonthlyRecordCount() {
    const closedRecords = await prisma.record.findMany({
      where: { status: 'CLOSED' },
      select: { scheduledAt: true },
    });

    const calcMap = new Map<string, number>();
    for (const r of closedRecords) {
      const d = new Date(r.scheduledAt);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const key = `${year}-${String(month).padStart(2, '0')}`;
      calcMap.set(key, (calcMap.get(key) ?? 0) + 1);
    }

    const overrides = await prisma.monthlyRecordCount.findMany();
    const overrideMap = new Map(overrides.map(o => [`${o.year}-${String(o.month).padStart(2, '0')}`, o.count]));

    const allKeys = new Set([...calcMap.keys(), ...overrideMap.keys()]);

    return Array.from(allKeys)
      .sort((a, b) => (a > b ? -1 : 1))
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        const count = overrideMap.has(key) ? overrideMap.get(key)! : (calcMap.get(key) ?? 0);
        return {
          key,
          year: y,
          month: m,
          label: `${MONTH_NAMES[m - 1]} ${y}`,
          labelShort: `${MONTH_NAMES_SHORT[m - 1]} ${y}`,
          count,
          isOverride: overrideMap.has(key),
        };
      });
  },

  async setMonthlyRecordCount(year: number, month: number, count: number) {
    return prisma.monthlyRecordCount.upsert({
      where: { year_month: { year, month } },
      update: { count },
      create: { year, month, count },
    });
  },
};
