import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { baseSalaryFor, effectiveSalaryMonth, monthsWithBaseSalary } from '../salaryRates';
import { EMPLOYEE_SALARY_PREFIX, MONTH_NAMES_SHORT, roundMoney } from './shared';
import { adjustedTotal, effectivePercent, paymentFor, paymentType, salaryPeriod, servicemanShare } from './salaryCalc';

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
  closedAt: string;
  salaryDate: string | null;
  items: SalaryRecordItem[];
  totalNetProfit: number;
  totalPayment: number;
}

export interface SalaryAdjustmentDto {
  id: string;
  servicemanName: string;
  type: 'FINE' | 'BONUS';
  amount: number;
  reason: string;
  year: number;
  month: number;
  createdAt: string;
}

export interface SalaryPaymentDto {
  id: string;
  type: 'ADVANCE' | 'FINAL';
  amount: number;
  cashAmount: number;
  cardAmount: number;
  date: string;
  person: string | null;
  createdAt: string;
}

export interface SalaryData {
  servicemanName: string;
  profitPercent: number;
  periodFrom: string;
  periodTo: string;
  records: SalaryRecord[];
  totalNetProfit: number;
  totalPayment: number;
  // Оклад за период (по истории окладов)
  baseSalary: number;
  adjustments: SalaryAdjustmentDto[];
  adjustedTotal: number;
  payments: SalaryPaymentDto[];
  paidTotal: number;
  // Остаток к выплате; отрицательный — переплата
  remaining: number;
}

const carInfo = (car: { brand: string; model: string; year: string; plateNumber: string | null }) =>
  `${car.brand} ${car.model} ${car.year}${car.plateNumber ? ' ' + car.plateNumber : ''}`;

/** Зарплата сотрудников: расчёт за период, выплаты, премии/штрафы, история по месяцам */
export const salaryService = {
  async getSalaryData(servicemanName: string, year: number, month: number): Promise<SalaryData> {
    const period = salaryPeriod(year, month);

    const serviceman = await prisma.serviceman.findUnique({
      where: { name: servicemanName },
      include: { salaryRates: true },
    });
    const profitPercent = serviceman?.profitPercent ?? 0;
    const baseSalary = baseSalaryFor(serviceman?.salaryRates ?? [], { year, month });

    // Работы попадают в период по дате зарплаты сделки (если её перенесли) или по дате закрытия
    const allItems = await prisma.recordItem.findMany({
      where: {
        record: {
          deal: {
            OR: [
              { salaryDate: { gte: period.from, lt: period.to } },
              { salaryDate: null, closedAt: { gte: period.from, lt: period.to } },
            ],
          },
        },
      },
      include: {
        service: { include: { category: true } },
        record: { include: { client: true, car: true, deal: { select: { salaryDate: true, closedAt: true } } } },
      },
    });

    const recordMap = new Map<string, SalaryRecord>();
    for (const item of allItems) {
      const share = servicemanShare(item, servicemanName);
      if (share === null) continue;

      const { record } = item;
      const payment = paymentFor(share, effectivePercent(item.service, profitPercent));
      let rec = recordMap.get(record.id);
      if (!rec) {
        rec = {
          recordId: record.id,
          clientName: record.client.name,
          carInfo: carInfo(record.car),
          scheduledAt: record.scheduledAt.toISOString(),
          // Работа попадает в зарплату по дате завершения, её же и показываем
          closedAt: (record.deal?.closedAt ?? record.scheduledAt).toISOString(),
          salaryDate: record.deal?.salaryDate?.toISOString() ?? null,
          items: [],
          totalNetProfit: 0,
          totalPayment: 0,
        };
        recordMap.set(record.id, rec);
      }
      rec.items.push({ serviceName: item.service.name, netProfit: share, payment });
      rec.totalNetProfit += share;
      rec.totalPayment += payment;
    }

    const records = Array.from(recordMap.values())
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
    const totalNetProfit = records.reduce((s, r) => s + r.totalNetProfit, 0);
    const totalPayment = records.reduce((s, r) => s + r.totalPayment, 0);

    const rawAdjustments = await prisma.salaryAdjustment.findMany({
      where: { servicemanName, year, month },
      orderBy: { createdAt: 'asc' },
    });
    const adjustments: SalaryAdjustmentDto[] = rawAdjustments.map(a => ({
      id: a.id,
      servicemanName: a.servicemanName,
      type: a.type,
      amount: a.amount,
      reason: a.reason,
      year: a.year,
      month: a.month,
      createdAt: a.createdAt.toISOString(),
    }));
    const total = adjustedTotal(totalPayment, baseSalary, adjustments);

    const rawPayments = await prisma.employeeSalaryPayment.findMany({
      where: { servicemanName, year, month },
      include: { cashTransaction: { select: { date: true, person: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const payments: SalaryPaymentDto[] = rawPayments.map(p => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      cashAmount: roundMoney(p.amount - p.cardAmount),
      cardAmount: p.cardAmount,
      date: (p.cashTransaction?.date ?? p.date).toISOString(),
      person: p.cashTransaction?.person ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
    const paidTotal = roundMoney(payments.reduce((s, p) => s + p.amount, 0));

    return {
      servicemanName,
      profitPercent,
      periodFrom: period.from.toISOString(),
      periodTo: period.to.toISOString(),
      records,
      totalNetProfit,
      totalPayment,
      baseSalary,
      adjustments,
      adjustedTotal: total,
      payments,
      paidTotal,
      remaining: roundMoney(total - paidTotal),
    };
  },

  async createSalaryPayment(data: {
    servicemanName: string;
    year: number;
    month: number;
    amount: number;
    cardAmount: number;
    date: string;
    person?: string;
  }) {
    const cashAmount = roundMoney(data.amount - data.cardAmount);
    if (cashAmount < 0) throw new AppError('Сумма на карту больше суммы выплаты', 400);
    if (cashAmount > 0 && !data.person) throw new AppError('Выберите изымателя', 400);

    const serviceman = await prisma.serviceman.findUnique({ where: { name: data.servicemanName } });
    if (!serviceman) throw new AppError('Сотрудник не найден', 404);

    const { remaining } = await salaryService.getSalaryData(data.servicemanName, data.year, data.month);
    // Всё, что меньше остатка, — аванс; остаток целиком (в т.ч. с округлением вверх) — расчёт
    const type = paymentType(data.amount, remaining);
    const period = `${MONTH_NAMES_SHORT[data.month - 1]} ${data.year}`;
    const card = data.cardAmount > 0 ? `, ещё ${data.cardAmount} р. на карту` : '';
    const description = `${EMPLOYEE_SALARY_PREFIX} ${data.servicemanName}${type === 'ADVANCE' ? ' (аванс)' : ''} за ${period}${card}`;
    const date = new Date(data.date);

    // В кассу идут только наличные: расход создаётся на наличную часть вместе с выплатой
    // одной записью (либо обе, либо ни одной). Если всё на карту — только выплата
    return prisma.employeeSalaryPayment.create({
      data: {
        serviceman: { connect: { name: data.servicemanName } },
        year: data.year,
        month: data.month,
        type,
        amount: data.amount,
        cardAmount: data.cardAmount,
        date,
        ...(cashAmount > 0 && {
          cashTransaction: {
            create: { type: 'EXPENSE' as const, date, description, amount: cashAmount, person: data.person },
          },
        }),
      },
    });
  },

  // Выплата удаляется вместе с расходом в кассе (каскадом)
  async deleteSalaryPayment(id: string) {
    const payment = await prisma.employeeSalaryPayment.findUnique({ where: { id } });
    if (!payment) throw new AppError('Выплата не найдена', 404);
    if (payment.cashTransactionId) {
      await prisma.cashTransaction.delete({ where: { id: payment.cashTransactionId } });
    } else {
      await prisma.employeeSalaryPayment.delete({ where: { id } });
    }
  },

  /** Итоги по расчётным месяцам за всё время — для графика сотрудников на дашборде */
  async getSalaryHistory(servicemanName: string) {
    const serviceman = await prisma.serviceman.findUnique({
      where: { name: servicemanName },
      include: { salaryRates: true },
    });
    const profitPercent = serviceman?.profitPercent ?? 0;
    const rates = serviceman?.salaryRates ?? [];

    const allItems = await prisma.recordItem.findMany({
      where: { record: { deal: { isNot: null } } },
      include: {
        service: { include: { category: true } },
        record: { include: { deal: { select: { salaryDate: true, closedAt: true } } } },
      },
    });

    const monthMap = new Map<string, { year: number; month: number; totalPayment: number; recordIds: Set<string> }>();
    const keyOf = (m: { year: number; month: number }) => `${m.year}-${String(m.month).padStart(2, '0')}`;

    for (const item of allItems) {
      const share = servicemanShare(item, servicemanName);
      if (share === null || !item.record.deal) continue;

      const m = effectiveSalaryMonth(item.record.deal.salaryDate ?? item.record.deal.closedAt);
      const key = keyOf(m);
      if (!monthMap.has(key)) monthMap.set(key, { ...m, totalPayment: 0, recordIds: new Set() });
      const entry = monthMap.get(key)!;
      entry.totalPayment += paymentFor(share, effectivePercent(item.service, profitPercent));
      entry.recordIds.add(item.recordId);
    }

    const adjustments = await prisma.salaryAdjustment.findMany({ where: { servicemanName } });
    // Месяцы только с окладом (без работ и корректировок) тоже попадают в историю
    for (const m of [...adjustments, ...monthsWithBaseSalary(rates)]) {
      const key = keyOf(m);
      if (!monthMap.has(key)) monthMap.set(key, { year: m.year, month: m.month, totalPayment: 0, recordIds: new Set() });
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, m]) => {
        const monthAdj = adjustments.filter(a => a.year === m.year && a.month === m.month);
        return {
          year: m.year,
          month: m.month,
          label: `${MONTH_NAMES_SHORT[m.month - 1]} ${m.year}`,
          adjustedTotal: Math.max(0, adjustedTotal(m.totalPayment, baseSalaryFor(rates, m), monthAdj)),
          recordCount: m.recordIds.size,
        };
      });
  },

  async createAdjustment(data: { servicemanName: string; type: 'FINE' | 'BONUS'; amount: number; reason: string; year: number; month: number }) {
    const { servicemanName, ...rest } = data;
    return prisma.salaryAdjustment.create({ data: { ...rest, serviceman: { connect: { name: servicemanName } } } });
  },

  async deleteAdjustment(id: string) {
    return prisma.salaryAdjustment.delete({ where: { id } });
  },

  async getFounderSalaries() {
    return prisma.founderSalary.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }, { createdAt: 'asc' }] });
  },
};
