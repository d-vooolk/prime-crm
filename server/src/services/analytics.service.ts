import { prisma } from '../prisma/client';
import { parseDay, nextDay } from '../utils/date';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  switch (period) {
    case 'day':
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case 'week':
      from.setDate(now.getDate() - now.getDay() + 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      from.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'year':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
  }

  return { from, to };
}

export const analyticsService = {
  async getSummary(period: Period) {
    const { from, to } = getPeriodRange(period);

    // Months wholly contained within [from, to] — only these honor monthly overrides
    const wholeMonths = new Set<string>();
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      if (monthStart >= from && monthEnd <= to) {
        wholeMonths.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Revenue — sum of income cash transactions, honoring monthly overrides for whole months
    const revenueOverrides = await prisma.monthlyRevenue.findMany();
    const revenueOverrideMap = new Map(revenueOverrides.map(o => [`${o.year}-${String(o.month).padStart(2, '0')}`, o.amount]));
    const txs = await prisma.cashTransaction.findMany({ where: { date: { gte: from, lte: to } } });
    let totalRevenue = 0;
    for (const tx of txs) {
      if (tx.type !== 'INCOME' && tx.type !== 'MANUAL_INCOME' && tx.type !== 'INCOME_RS') continue;
      const key = monthKey(new Date(tx.date));
      if (wholeMonths.has(key) && revenueOverrideMap.has(key)) continue;
      totalRevenue += tx.amount;
    }
    for (const key of wholeMonths) {
      if (revenueOverrideMap.has(key)) totalRevenue += revenueOverrideMap.get(key)!;
    }

    // Closed records — count of Record(status=CLOSED, scheduledAt in range), honoring count overrides
    const countOverrides = await prisma.monthlyRecordCount.findMany();
    const countOverrideMap = new Map(countOverrides.map(o => [`${o.year}-${String(o.month).padStart(2, '0')}`, o.count]));
    const closedRecords = await prisma.record.findMany({
      where: { status: 'CLOSED', scheduledAt: { gte: from, lte: to } },
      select: { scheduledAt: true },
    });
    let closedCount = 0;
    for (const r of closedRecords) {
      const key = monthKey(new Date(r.scheduledAt));
      if (wholeMonths.has(key) && countOverrideMap.has(key)) continue;
      closedCount++;
    }
    for (const key of wholeMonths) {
      if (countOverrideMap.has(key)) closedCount += countOverrideMap.get(key)!;
    }

    const activeRecords = await prisma.record.count({
      where: {
        scheduledAt: { gte: from, lte: to },
        status: 'ACTIVE',
      },
    });

    return { closedCount, totalRevenue, activeRecords, period, from, to };
  },

  async getRevenueChart(from: string, to: string) {
    const deals = await prisma.deal.findMany({
      where: {
        closedAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { closedAt: 'asc' },
      select: { closedAt: true, finalPrice: true },
    });

    // Группируем по дням
    const grouped: Record<string, number> = {};
    for (const deal of deals) {
      const key = deal.closedAt.toISOString().split('T')[0];
      grouped[key] = (grouped[key] || 0) + deal.finalPrice;
    }

    return Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
  },

  async getTopServices(period: Period) {
    const { from, to } = getPeriodRange(period);

    const items = await prisma.recordItem.groupBy({
      by: ['serviceId'],
      where: {
        record: {
          scheduledAt: { gte: from, lte: to },
          status: 'CLOSED',
        },
      },
      _count: { serviceId: true },
      _sum: { price: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 10,
    });

    const services = await prisma.service.findMany({
      where: { id: { in: items.map((i: { serviceId: string }) => i.serviceId) } },
    });

    return items.map(item => ({
      service: services.find(s => s.id === item.serviceId),
      count: item._count.serviceId,
      // Агрегаты Prisma по DECIMAL — объекты Decimal, наружу отдаём числом
      total: item._sum.price == null ? null : Number(item._sum.price),
    }));
  },

  /**
   * Каналы привлечения за период [from; to] (даты записи, включительно).
   * По каждому источнику: записи, отмены, закрытые сделки, конверсия, выручка, средний чек,
   * клиенты и новые клиенты (у кого это первая запись вообще). Плюс помесячная динамика и
   * расходы на рекламу за период (категории затрат со словом «реклам») — для цены нового клиента.
   */
  async getSourceStats(fromStr: string, toStr: string) {
    const from = parseDay(fromStr);
    const to = nextDay(parseDay(toStr));

    const records = await prisma.record.findMany({
      where: { scheduledAt: { gte: from, lt: to } },
      select: {
        id: true, clientId: true, clientSource: true, status: true, scheduledAt: true,
        deal: { select: { finalPrice: true } },
      },
    });

    // Первая запись каждого клиента из периода — по всей истории, а не только внутри периода
    const clientIds = [...new Set(records.map(r => r.clientId))];
    const firstRecords = clientIds.length
      ? await prisma.record.groupBy({ by: ['clientId'], where: { clientId: { in: clientIds } }, _min: { scheduledAt: true } })
      : [];
    const firstVisit = new Map(firstRecords.map(f => [f.clientId, f._min.scheduledAt?.getTime()]));

    type Row = {
      source: string; records: number; cancelled: number; closed: number; revenue: number;
      clients: Set<string>; newClients: Set<string>;
    };
    const rows = new Map<string, Row>();
    const months = new Map<string, Record<string, number>>();
    for (const r of records) {
      const source = r.clientSource ?? 'NONE';
      let row = rows.get(source);
      if (!row) {
        row = { source, records: 0, cancelled: 0, closed: 0, revenue: 0, clients: new Set(), newClients: new Set() };
        rows.set(source, row);
      }
      row.records += 1;
      if (r.status === 'CANCELLED') row.cancelled += 1;
      if (r.status === 'CLOSED') {
        row.closed += 1;
        row.revenue += r.deal?.finalPrice ?? 0;
      }
      row.clients.add(r.clientId);
      if (firstVisit.get(r.clientId) === r.scheduledAt.getTime()) row.newClients.add(r.clientId);

      const month = `${r.scheduledAt.getFullYear()}-${String(r.scheduledAt.getMonth() + 1).padStart(2, '0')}`;
      const m = months.get(month) ?? {};
      m[source] = (m[source] ?? 0) + 1;
      months.set(month, m);
    }

    const round = (v: number) => Math.round(v * 100) / 100;
    const sources = [...rows.values()]
      .map(row => {
        const considered = row.records - row.cancelled;
        return {
          source: row.source,
          records: row.records,
          cancelled: row.cancelled,
          closed: row.closed,
          // Доля закрытых среди неотменённых записей
          conversion: considered > 0 ? round((row.closed / considered) * 100) : 0,
          revenue: round(row.revenue),
          avgCheck: row.closed > 0 ? round(row.revenue / row.closed) : 0,
          clients: row.clients.size,
          newClients: row.newClients.size,
        };
      })
      .sort((a, b) => b.records - a.records);

    const adAgg = await prisma.cashTransaction.aggregate({
      where: {
        type: 'EXPENSE',
        date: { gte: from, lt: to },
        expenseCategory: { name: { contains: 'реклам', mode: 'insensitive' } },
      },
      _sum: { amount: true },
    });
    const adExpenses = round(Number(adAgg._sum.amount ?? 0));
    const newClientsTotal = sources.reduce((s, r) => s + r.newClients, 0);

    return {
      from: fromStr,
      to: toStr,
      sources,
      months: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, counts]) => ({ month, counts })),
      adExpenses,
      newClients: newClientsTotal,
      costPerNewClient: newClientsTotal > 0 ? round(adExpenses / newClientsTotal) : null,
    };
  },
};
