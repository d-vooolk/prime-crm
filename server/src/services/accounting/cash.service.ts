import { prisma, DbClient } from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { CASH_TRANSACTION_INCLUDE, expensesService } from '../expenses.service';
import {
  isFounderSalaryDescription, FOUNDER_SALARY_MANUAL_ERROR,
  isEmployeeSalaryDescription, EMPLOYEE_SALARY_MANUAL_ERROR, roundMoney,
} from './shared';

/** Касса: приходы и расходы наличных/РС, баланс */
export const cashService = {
  async getCashForMonth(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const rows = await prisma.cashTransaction.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
      include: CASH_TRANSACTION_INCLUDE,
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
    // Название категории затрат; новой категории ещё нет — создаётся
    expenseCategory?: string | null;
  }) {
    const { founderSalary } = data;
    // Категория обязательна — иначе расход не разложится в аналитике. ЗП учредителя — системный расход, ей не нужна
    if (!founderSalary && !data.expenseCategory?.trim()) throw new AppError('Укажите категорию расхода', 400);
    const expenseCategoryId = founderSalary ? null : await expensesService.resolveCategoryId(data.expenseCategory);
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
        expenseCategoryId: expenseCategoryId ?? null,
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

  /** Приход по закрытой сделке; db — чтобы вызывать внутри транзакции закрытия */
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
  }, db: DbClient = prisma) {
    const base = {
      date: data.closedAt,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      carInfo: data.carInfo,
      recordId: data.recordId,
    };
    if (data.splitCashAmount != null && data.splitCardAmount != null) {
      if (data.splitCashAmount > 0) {
        await db.cashTransaction.create({ data: { ...base, type: 'INCOME', amount: data.splitCashAmount } });
      }
      if (data.splitCardAmount > 0) {
        await db.cashTransaction.create({ data: { ...base, type: 'INCOME_RS', amount: data.splitCardAmount } });
      }
      return;
    }
    return db.cashTransaction.create({
      data: { ...base, type: data.isPaidByBankTransfer ? 'INCOME_RS' : 'INCOME', amount: data.amount },
    });
  },

  async updateCashTransaction(id: string, data: { date?: string; amount?: number; description?: string; person?: string; expenseCategory?: string | null }) {
    // Категорию ставим только обычным расходам; у системных (ЗП, капитал, долги) поле игнорируется.
    // Снять категорию с обычного расхода нельзя — она обязательна
    const canHaveCategory = data.expenseCategory !== undefined && await expensesService.canHaveCategory(id);
    if (canHaveCategory && !data.expenseCategory?.trim()) throw new AppError('Укажите категорию расхода', 400);
    const expenseCategoryId = canHaveCategory
      ? await expensesService.resolveCategoryId(data.expenseCategory)
      : undefined;
    return prisma.$transaction(async (tx) => {
      if (data.amount !== undefined) {
        // Валютный приход и отчисление в капитал связаны с суммой в капитале — правка суммы их рассинхронизирует
        const linked = await tx.cashTransaction.findUnique({
          where: { id },
          select: { amount: true, currency: true, capitalTransfer: { select: { id: true } } },
        });
        if (linked && linked.amount !== data.amount && (linked.currency || linked.capitalTransfer)) {
          throw new AppError('Сумму валютной операции или отчисления в капитал не меняют: удалите запись и создайте заново', 400);
        }
      }
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
          ...(expenseCategoryId !== undefined && { expenseCategoryId }),
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
};
