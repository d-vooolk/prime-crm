import { prisma } from '../prisma/client';

export interface SalaryRecordItem {
  serviceName: string;
  netProfit: number;
  payment: number;
}

export interface SalaryRecord {
  recordId: string;
  clientName: string;
  carInfo: string;
  scheduledAt: string;
  items: SalaryRecordItem[];
  totalNetProfit: number;
  totalPayment: number;
}

export interface SalaryData {
  servicemanName: string;
  profitPercent: number;
  periodFrom: string;
  periodTo: string;
  records: SalaryRecord[];
  totalNetProfit: number;
  totalPayment: number;
}

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

  async getSalaryData(servicemanName: string, year: number, month: number): Promise<SalaryData> {
    // Period: 25th of previous month to 24th of current month
    const periodFrom = new Date(year, month - 2, 25); // 25th of prev month
    const periodTo = new Date(year, month - 1, 25);   // 25th of current month (exclusive)

    const serviceman = await prisma.serviceman.findUnique({ where: { name: servicemanName } });
    const profitPercent = serviceman?.profitPercent ?? 0;

    const items = await prisma.recordItem.findMany({
      where: {
        servicemanName,
        record: {
          deal: {
            closedAt: { gte: periodFrom, lt: periodTo },
          },
        },
      },
      include: {
        service: true,
        record: {
          include: {
            client: true,
            car: true,
            deal: true,
          },
        },
      },
    });

    const recordMap = new Map<string, SalaryRecord>();
    for (const item of items) {
      const { record } = item;
      const netProfit = item.netProfit ?? 0;
      const payment = Math.round(netProfit * profitPercent) / 100;
      if (!recordMap.has(record.id)) {
        recordMap.set(record.id, {
          recordId: record.id,
          clientName: record.client.name,
          carInfo: `${record.car.brand} ${record.car.model} ${record.car.year}${record.car.plateNumber ? ' ' + record.car.plateNumber : ''}`,
          scheduledAt: record.scheduledAt.toISOString(),
          items: [],
          totalNetProfit: 0,
          totalPayment: 0,
        });
      }
      const rec = recordMap.get(record.id)!;
      rec.items.push({ serviceName: item.service.name, netProfit, payment });
      rec.totalNetProfit += netProfit;
      rec.totalPayment += payment;
    }

    const records = Array.from(recordMap.values());
    const totalNetProfit = records.reduce((s, r) => s + r.totalNetProfit, 0);
    const totalPayment = records.reduce((s, r) => s + r.totalPayment, 0);

    return {
      servicemanName,
      profitPercent,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      records,
      totalNetProfit,
      totalPayment,
    };
  },

  async createWithdrawal(data: { date: string; amount: number; currency: 'BYN' | 'USD'; description?: string; person: string }) {
    return prisma.capitalTransaction.create({
      data: {
        type: 'WITHDRAWAL',
        date: new Date(data.date),
        amountByn: data.currency === 'BYN' ? data.amount : undefined,
        amountUsd: data.currency === 'USD' ? data.amount : undefined,
        description: data.description,
        person: data.person,
      },
    });
  },
};
