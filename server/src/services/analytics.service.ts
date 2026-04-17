import { prisma } from '../prisma/client';

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

    const deals = await prisma.deal.findMany({
      where: { closedAt: { gte: from, lte: to } },
      include: { record: { include: { items: true } } },
    });

    const closedCount = deals.length;
    const totalRevenue = deals.reduce((sum: number, d: { finalPrice: number }) => sum + d.finalPrice, 0);

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

    return items.map((item: { serviceId: string; _count: { serviceId: number }; _sum: { price: number | null } }) => ({
      service: services.find((s: { id: string }) => s.id === item.serviceId),
      count: item._count.serviceId,
      total: item._sum.price,
    }));
  },
};
