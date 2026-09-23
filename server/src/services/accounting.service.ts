import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { baseSalaryFor, monthsWithBaseSalary } from './salaryRates';

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

// Описание расхода-ЗП учредителя. Такие расходы создаются только через свитч
// «ЗП учредителей», иначе сумма не попадёт в таблицу учредителей
export const FOUNDER_SALARY_PREFIX = 'ЗП учредителя';

const isFounderSalaryDescription = (description?: string | null) =>
  !!description && description.trim().toLowerCase().startsWith(FOUNDER_SALARY_PREFIX.toLowerCase());

const FOUNDER_SALARY_MANUAL_ERROR =
  `Описание «${FOUNDER_SALARY_PREFIX} …» зарезервировано: включите свитч «ЗП учредителей»`;

// Описание расхода-выплаты ЗП сотруднику. Такие расходы создаются только кнопкой
// «Выплатить ЗП» в расчёте зарплаты, иначе выплата не попадёт в остаток сотрудника
export const EMPLOYEE_SALARY_PREFIX = 'ЗП сотрудника';

const isEmployeeSalaryDescription = (description?: string | null) =>
  !!description && description.trim().toLowerCase().startsWith(EMPLOYEE_SALARY_PREFIX.toLowerCase());

const EMPLOYEE_SALARY_MANUAL_ERROR =
  `Описание «${EMPLOYEE_SALARY_PREFIX} …» зарезервировано: выплатите ЗП из расчёта зарплаты`;

const SALARY_MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// Копейки после сложения/вычитания Float — округляем, чтобы остаток 0.0000001 не считался долгом
const roundMoney = (v: number) => Math.round(v * 100) / 100;

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

  async createExpense(data: {
    date: string;
    description: string;
    amount: number;
    person: string;
    founderSalary?: { year: number; month: number; person: string };
  }) {
    const { founderSalary } = data;
    if (!founderSalary && isFounderSalaryDescription(data.description)) {
      throw new AppError(FOUNDER_SALARY_MANUAL_ERROR, 400);
    }
    if (isEmployeeSalaryDescription(data.description)) {
      throw new AppError(EMPLOYEE_SALARY_MANUAL_ERROR, 400);
    }
    if (founderSalary) {
      if (!founderSalary.person) throw new AppError('Выберите учредителя', 400);
      if (!Number.isInteger(founderSalary.year) || !Number.isInteger(founderSalary.month)
        || founderSalary.month < 1 || founderSalary.month > 12) {
        throw new AppError('Некорректный месяц ЗП', 400);
      }
    }
    // Расход и ЗП учредителя создаются одной записью: либо обе, либо ни одной
    return prisma.cashTransaction.create({
      data: {
        type: 'EXPENSE',
        date: new Date(data.date),
        description: data.description,
        amount: data.amount,
        person: data.person,
        ...(founderSalary && {
          founderSalary: { create: { ...founderSalary, amount: data.amount } },
        }),
      },
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
    splitCashAmount?: number;
    splitCardAmount?: number;
    closedAt: Date;
  }) {
    const base = {
      date: data.closedAt,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      carInfo: data.carInfo,
      recordId: data.recordId,
    };
    if (data.splitCashAmount != null && data.splitCardAmount != null) {
      const ops = [];
      if (data.splitCashAmount > 0) {
        ops.push(prisma.cashTransaction.create({ data: { ...base, type: 'INCOME', amount: data.splitCashAmount } }));
      }
      if (data.splitCardAmount > 0) {
        ops.push(prisma.cashTransaction.create({ data: { ...base, type: 'INCOME_RS', amount: data.splitCardAmount } }));
      }
      await Promise.all(ops);
      return;
    }
    return prisma.cashTransaction.create({
      data: { ...base, type: data.isPaidByBankTransfer ? 'INCOME_RS' : 'INCOME', amount: data.amount },
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

    const serviceman = await prisma.serviceman.findUnique({
      where: { name: servicemanName },
      include: { salaryRates: true },
    });
    const profitPercent = serviceman?.profitPercent ?? 0;
    const baseSalary = baseSalaryFor(serviceman?.salaryRates ?? [], { year, month });

    type SplitEntry = { name: string; amount: number };

    // Query all closed items in the period (use salaryDate override if set)
    const allItems = await prisma.recordItem.findMany({
      where: {
        record: {
          deal: {
            OR: [
              { salaryDate: { gte: periodFrom, lt: periodTo } },
              { salaryDate: null, closedAt: { gte: periodFrom, lt: periodTo } },
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
      let netProfit: number | null = null;

      if (!item.servicemanSplit) {
        if (item.servicemanName === servicemanName) netProfit = item.netProfit ?? 0;
      } else {
        const split = item.servicemanSplit as SplitEntry[];
        const entry = Array.isArray(split) ? split.find(s => s.name === servicemanName) : undefined;
        if (entry) netProfit = entry.amount;
      }

      if (netProfit === null) continue;

      const { record } = item;
      const effectivePercent = item.service.customPercent
        ?? (item.service as { customPercent?: number | null; category: { customPercent?: number | null } }).category?.customPercent
        ?? profitPercent;
      const payment = Math.round(netProfit * effectivePercent) / 100;
      if (!recordMap.has(record.id)) {
        recordMap.set(record.id, {
          recordId: record.id,
          clientName: record.client.name,
          carInfo: `${record.car.brand} ${record.car.model} ${record.car.year}${record.car.plateNumber ? ' ' + record.car.plateNumber : ''}`,
          scheduledAt: record.scheduledAt.toISOString(),
          // Работа попадает в зарплату по дате завершения, её же и показываем
          closedAt: (record.deal?.closedAt ?? record.scheduledAt).toISOString(),
          salaryDate: record.deal?.salaryDate?.toISOString() ?? null,
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
      type: a.type as 'FINE' | 'BONUS',
      amount: a.amount,
      reason: a.reason,
      year: a.year,
      month: a.month,
      createdAt: a.createdAt.toISOString(),
    }));
    const bonusTotal = adjustments.filter(a => a.type === 'BONUS').reduce((s, a) => s + a.amount, 0);
    const fineTotal = adjustments.filter(a => a.type === 'FINE').reduce((s, a) => s + a.amount, 0);
    const adjustedTotal = totalPayment + baseSalary + bonusTotal - fineTotal;

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
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      records,
      totalNetProfit,
      totalPayment,
      baseSalary,
      adjustments,
      adjustedTotal,
      payments,
      paidTotal,
      remaining: roundMoney(adjustedTotal - paidTotal),
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

    const { remaining } = await accountingService.getSalaryData(data.servicemanName, data.year, data.month);
    // Всё, что меньше остатка, — аванс; остаток целиком (в т.ч. с округлением вверх) — расчёт
    const type = data.amount >= remaining ? 'FINAL' : 'ADVANCE';
    const period = `${SALARY_MONTH_NAMES[data.month - 1]} ${data.year}`;
    const card = data.cardAmount > 0 ? `, ещё ${data.cardAmount} р. на карту` : '';
    const description = `${EMPLOYEE_SALARY_PREFIX} ${data.servicemanName}${type === 'ADVANCE' ? ' (аванс)' : ''} за ${period}${card}`;
    const date = new Date(data.date);

    // В кассу идут только наличные: расход создаётся на наличную часть вместе с выплатой
    // одной записью (либо обе, либо ни одной). Если всё на карту — только выплата
    return prisma.employeeSalaryPayment.create({
      data: {
        servicemanName: data.servicemanName,
        year: data.year,
        month: data.month,
        type,
        amount: data.amount,
        cardAmount: data.cardAmount,
        date,
        ...(cashAmount > 0 && {
          cashTransaction: {
            create: { type: 'EXPENSE', date, description, amount: cashAmount, person: data.person },
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

  async getSalaryHistory(servicemanName: string) {
    const serviceman = await prisma.serviceman.findUnique({
      where: { name: servicemanName },
      include: { salaryRates: true },
    });
    const profitPercent = serviceman?.profitPercent ?? 0;
    const rates = serviceman?.salaryRates ?? [];

    type SplitEntry = { name: string; amount: number };

    const allItems = await prisma.recordItem.findMany({
      where: { record: { deal: { isNot: null } } },
      include: {
        service: { include: { category: true } },
        record: { include: { deal: { select: { salaryDate: true, closedAt: true } } } },
      },
    });

    const monthMap = new Map<string, { year: number; month: number; totalPayment: number; recordIds: Set<string> }>();

    for (const item of allItems) {
      let netProfit: number | null = null;

      if (!item.servicemanSplit) {
        if (item.servicemanName === servicemanName) netProfit = item.netProfit ?? 0;
      } else {
        const split = item.servicemanSplit as SplitEntry[];
        const entry = Array.isArray(split) ? split.find(s => s.name === servicemanName) : undefined;
        if (entry) netProfit = entry.amount;
      }

      if (netProfit === null || !item.record.deal) continue;

      const effectiveDate = item.record.deal.salaryDate ?? item.record.deal.closedAt;
      const d = new Date(effectiveDate);
      let year = d.getFullYear();
      let month = d.getMonth() + 1;
      if (d.getDate() >= 25) {
        month++;
        if (month > 12) { month = 1; year++; }
      }

      const key = `${year}-${String(month).padStart(2, '0')}`;
      const effectivePercent = item.service.customPercent
        ?? (item.service as { customPercent?: number | null; category: { customPercent?: number | null } }).category?.customPercent
        ?? profitPercent;
      const payment = Math.round(netProfit * effectivePercent) / 100;

      if (!monthMap.has(key)) monthMap.set(key, { year, month, totalPayment: 0, recordIds: new Set() });
      const m = monthMap.get(key)!;
      m.totalPayment += payment;
      m.recordIds.add(item.recordId);
    }

    const adjustments = await prisma.salaryAdjustment.findMany({ where: { servicemanName } });
    // Месяцы только с окладом (без работ и корректировок) тоже попадают в историю
    for (const m of [...adjustments, ...monthsWithBaseSalary(rates)]) {
      const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { year: m.year, month: m.month, totalPayment: 0, recordIds: new Set() });
    }

    const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, m]) => {
        const monthAdj = adjustments.filter(a => a.year === m.year && a.month === m.month);
        const bonus = monthAdj.filter(a => a.type === 'BONUS').reduce((s, a) => s + a.amount, 0);
        const fine = monthAdj.filter(a => a.type === 'FINE').reduce((s, a) => s + a.amount, 0);
        const adjustedTotal = Math.max(0, m.totalPayment + baseSalaryFor(rates, m) + bonus - fine);
        return {
          year: m.year,
          month: m.month,
          label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
          adjustedTotal,
          recordCount: m.recordIds.size,
        };
      });
  },

  async getMonthlyRevenue() {
    const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

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
    const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

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

  async createAdjustment(data: { servicemanName: string; type: 'FINE' | 'BONUS'; amount: number; reason: string; year: number; month: number }) {
    return prisma.salaryAdjustment.create({ data });
  },

  async deleteAdjustment(id: string) {
    return prisma.salaryAdjustment.delete({ where: { id } });
  },

  async getFounderSalaries() {
    return prisma.founderSalary.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }, { createdAt: 'asc' }] });
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

  async updateCashTransaction(id: string, data: { date?: string; amount?: number; description?: string; person?: string }) {
    return prisma.$transaction(async (tx) => {
      if (data.description !== undefined && isEmployeeSalaryDescription(data.description)) {
        const current = await tx.cashTransaction.findUnique({ where: { id }, select: { description: true } });
        if (!current) throw new AppError('Запись не найдена', 404);
        if (!isEmployeeSalaryDescription(current.description)) {
          throw new AppError(EMPLOYEE_SALARY_MANUAL_ERROR, 400);
        }
      }
      if (data.description !== undefined && isFounderSalaryDescription(data.description)) {
        const current = await tx.cashTransaction.findUnique({ where: { id }, select: { description: true } });
        if (!current) throw new AppError('Запись не найдена', 404);
        // Уже существующее описание не мешает править сумму/дату, запрещено только вписать его заново
        if (!isFounderSalaryDescription(current.description)) {
          throw new AppError(FOUNDER_SALARY_MANUAL_ERROR, 400);
        }
      }
      const updated = await tx.cashTransaction.update({
        where: { id },
        data: {
          ...(data.date !== undefined && { date: new Date(data.date) }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.person !== undefined && { person: data.person }),
        },
      });
      // ЗП учредителя должна совпадать с суммой расхода, которым она выдана
      if (data.amount !== undefined) {
        await tx.founderSalary.updateMany({ where: { cashTransactionId: id }, data: { amount: data.amount } });
        // Расход — это наличная часть выплаты, карта остаётся прежней
        const payment = await tx.employeeSalaryPayment.findUnique({ where: { cashTransactionId: id } });
        if (payment) {
          await tx.employeeSalaryPayment.update({
            where: { id: payment.id },
            data: { amount: roundMoney(data.amount + payment.cardAmount) },
          });
        }
      }
      return updated;
    });
  },

  // Привязанные ЗП учредителя и выплата ЗП сотруднику удаляются каскадом (onDelete: Cascade в схеме)
  async deleteCashTransaction(id: string) {
    return prisma.cashTransaction.delete({ where: { id } });
  },

  async getDebts(archived: boolean) {
    return prisma.debt.findMany({
      where: { status: archived ? 'SETTLED' : 'ACTIVE' },
      include: { payments: { orderBy: { paidAt: 'asc' } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async createDebt(data: { description: string; amount: number; direction: 'WE_OWE' | 'OWED_TO_US' }) {
    if (!data.description) throw new AppError('Укажите, за что долг', 400);
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new AppError('Сумма долга должна быть больше нуля', 400);
    }
    const amount = Math.round(data.amount);
    return prisma.debt.create({
      data: {
        description: data.description,
        initialAmount: amount,
        remainingAmount: amount,
        direction: data.direction,
      },
      include: { payments: true },
    });
  },

  async updateDebt(id: string, data: { description?: string; amount?: number }) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    const update: { description?: string; initialAmount?: number; remainingAmount?: number } = {};
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
      const amount = Math.round(data.amount);
      update.initialAmount = amount;
      update.remainingAmount = amount;
    }
    return prisma.debt.update({ where: { id }, data: update, include: { payments: true } });
  },

  async deleteDebt(id: string) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    if (debt.payments.length > 0) {
      throw new AppError('Нельзя удалить долг, по которому есть погашения', 400);
    }
    return prisma.debt.delete({ where: { id } });
  },

  async payDebt(id: string, amount: number, person?: string) {
    const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
    if (!debt) throw new AppError('Долг не найден', 404);
    if (debt.status === 'SETTLED') throw new AppError('Долг уже погашен', 400);
    if (!Number.isFinite(amount)) throw new AppError('Некорректная сумма погашения', 400);
    const pay = Math.round(amount);
    if (pay <= 0) throw new AppError('Сумма погашения должна быть больше нуля', 400);
    if (pay > debt.remainingAmount) throw new AppError('Сумма погашения больше остатка долга', 400);

    const newRemaining = debt.remainingAmount - pay;
    const willSettle = newRemaining === 0;
    const prefix = willSettle ? 'Погашение' : 'Частичное погашение';
    const description = `${prefix} долга — ${debt.description}`;
    const cashType = debt.direction === 'OWED_TO_US' ? 'INCOME' : 'EXPENSE';
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const cashTx = await tx.cashTransaction.create({
        data: {
          type: cashType,
          date: now,
          amount: pay,
          description,
          person: person ?? null,
        },
      });

      await tx.debtPayment.create({
        data: { debtId: id, amount: pay, paidAt: now, cashTransactionId: cashTx.id },
      });

      return tx.debt.update({
        where: { id },
        data: {
          remainingAmount: newRemaining,
          status: willSettle ? 'SETTLED' : 'ACTIVE',
          settledAt: willSettle ? now : null,
        },
        include: { payments: { orderBy: { paidAt: 'asc' } } },
      });
    });
  },
};
