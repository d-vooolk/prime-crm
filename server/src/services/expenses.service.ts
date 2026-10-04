import { Prisma } from '@prisma/client';
import { prisma, DbClient } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';

// Стандартный список категорий затрат — засевается при первом старте (bootstrap/expenseCategories.ts)
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Расходники',
  'Поставщики',
  'Еда в офис',
  'Аренда',
  'Коммунальные услуги',
  'Реклама',
  'Инструмент и оборудование',
  'Хозтовары',
  'Налоги и сборы',
  'Связь и интернет',
  'Транспорт',
  'Прочее',
];

export const EXPENSE_CATEGORY_NAME_MAX = 60;

/**
 * Что подгружать к операциям кассы: категорию и признаки системного расхода
 * (ЗП учредителя, выплата ЗП, отчисление в капитал, погашение долга) — таким категория не нужна.
 */
export const CASH_TRANSACTION_INCLUDE = {
  expenseCategory: { select: { id: true, name: true } },
  founderSalary: { select: { id: true } },
  salaryPayment: { select: { id: true } },
  capitalTransfer: { select: { id: true } },
  // Категория долга — погашение с ней считается расходом этой категории (реклама, поставщики …)
  debtPayment: { select: { id: true, debt: { select: { expenseCategory: { select: { id: true, name: true } } } } } },
} satisfies Prisma.CashTransactionInclude;

// Группы системных расходов в аналитике. Ключи с префиксом, чтобы не пересечься с категориями
export const SYSTEM_EXPENSE_GROUPS = {
  founderSalary: { key: 'system:founderSalary', name: 'ЗП учредителей' },
  salaryPayment: { key: 'system:salaryPayment', name: 'ЗП сотрудников' },
  capitalTransfer: { key: 'system:capitalTransfer', name: 'Отчисления в капитал' },
  debtPayment: { key: 'system:debtPayment', name: 'Погашение долгов' },
} as const;
const NO_CATEGORY_GROUP = { key: 'none', name: 'Без категории' };

export type ExpenseGroupKind = 'system' | 'category' | 'none';

export interface ExpenseAnalyticsItem {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  person: string | null;
}

export interface ExpenseAnalyticsGroup {
  key: string;
  name: string;
  kind: ExpenseGroupKind;
  total: number;
  count: number;
  // По убыванию суммы
  items: ExpenseAnalyticsItem[];
}

export interface ExpenseAnalyticsMonth {
  // YYYY-MM
  month: string;
  // Ключ группы → сумма за месяц
  totals: Record<string, number>;
}

export interface ExpenseAnalytics {
  from: string;
  to: string;
  months: ExpenseAnalyticsMonth[];
  // По убыванию суммы
  groups: ExpenseAnalyticsGroup[];
}

const roundMoney = (v: number) => Math.round(v * 100) / 100;

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

type SystemMarks = {
  founderSalary: unknown;
  salaryPayment: unknown;
  capitalTransfer: unknown;
  debtPayment: unknown;
};

/** Системный расход — создан не формой «Изъять средства», категорию ему не ставим. */
const isSystemExpense = (tx: SystemMarks) =>
  !!(tx.founderSalary || tx.salaryPayment || tx.capitalTransfer || tx.debtPayment);

async function findByName(name: string, tx: DbClient = prisma) {
  return tx.expenseCategory.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
}

export const expensesService = {
  async listCategories() {
    const [categories, usage] = await Promise.all([
      prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.cashTransaction.groupBy({
        by: ['expenseCategoryId'],
        where: { type: 'EXPENSE', expenseCategoryId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(usage.map(u => [u.expenseCategoryId, u._count._all]));
    return categories.map(c => ({ ...c, usageCount: counts.get(c.id) ?? 0 }));
  },

  async createCategory(rawName: string) {
    const name = normalizeName(rawName);
    if (!name) throw new AppError('Укажите название категории', 400);
    if (await findByName(name)) throw new AppError(`Категория «${name}» уже есть`, 409);
    return prisma.expenseCategory.create({ data: { name } });
  },

  async renameCategory(id: string, rawName: string) {
    const name = normalizeName(rawName);
    if (!name) throw new AppError('Укажите название категории', 400);
    const existing = await findByName(name);
    if (existing && existing.id !== id) throw new AppError(`Категория «${name}» уже есть`, 409);
    return prisma.expenseCategory.update({ where: { id }, data: { name } });
  },

  // У расходов категория обнуляется (onDelete: SetNull), сами расходы остаются
  async deleteCategory(id: string) {
    await prisma.expenseCategory.delete({ where: { id } });
  },

  /**
   * Категория по введённому названию: существующая (без учёта регистра) или новая.
   * undefined — поле не передано (не трогаем), null/пустая строка — убрать категорию.
   */
  async resolveCategoryId(rawName: string | null | undefined, tx: DbClient = prisma) {
    if (rawName === undefined) return undefined;
    const name = normalizeName(rawName ?? '');
    if (!name) return null;
    if (name.length > EXPENSE_CATEGORY_NAME_MAX) {
      throw new AppError(`Название категории — не длиннее ${EXPENSE_CATEGORY_NAME_MAX} символов`, 400);
    }
    const existing = await findByName(name, tx);
    if (existing) return existing.id;
    try {
      const created = await tx.expenseCategory.create({ data: { name } });
      return created.id;
    } catch (e) {
      // Одновременно создали такую же — берём её
      const again = await findByName(name, prisma);
      if (again) return again.id;
      throw e;
    }
  },

  /** Можно ли ставить категорию этой операции: только обычным расходам. */
  async canHaveCategory(cashTransactionId: string) {
    const tx = await prisma.cashTransaction.findUnique({
      where: { id: cashTransactionId },
      select: { type: true, ...CASH_TRANSACTION_INCLUDE },
    });
    if (!tx) throw new AppError('Запись не найдена', 404);
    return tx.type === 'EXPENSE' && !isSystemExpense(tx);
  },

  /** Аналитика расходов по месяцам [from; to] включительно, from/to — YYYY-MM. */
  async getAnalytics(from: string, to: string): Promise<ExpenseAnalytics> {
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    if (fy * 12 + fm > ty * 12 + tm) throw new AppError('Начало периода позже конца', 400);
    if (ty * 12 + tm - (fy * 12 + fm) > 120) throw new AppError('Период — не больше 10 лет', 400);

    // Границы месяцев — как в кассе (accountingService.getCashForMonth)
    const rows = await prisma.cashTransaction.findMany({
      where: { type: 'EXPENSE', date: { gte: new Date(fy, fm - 1, 1), lt: new Date(ty, tm, 1) } },
      include: CASH_TRANSACTION_INCLUDE,
      orderBy: { date: 'asc' },
    });

    const months: ExpenseAnalyticsMonth[] = [];
    const monthIndex = new Map<string, ExpenseAnalyticsMonth>();
    for (let i = fy * 12 + (fm - 1); i <= ty * 12 + (tm - 1); i++) {
      const entry = { month: monthKey(Math.floor(i / 12), (i % 12) + 1), totals: {} };
      months.push(entry);
      monthIndex.set(entry.month, entry);
    }

    const groups = new Map<string, ExpenseAnalyticsGroup>();
    for (const r of rows) {
      const category = r.debtPayment ? r.debtPayment.debt.expenseCategory : r.expenseCategory;
      let group: { key: string; name: string };
      let kind: ExpenseGroupKind = 'system';
      if (r.founderSalary) group = SYSTEM_EXPENSE_GROUPS.founderSalary;
      else if (r.salaryPayment) group = SYSTEM_EXPENSE_GROUPS.salaryPayment;
      else if (r.capitalTransfer) group = SYSTEM_EXPENSE_GROUPS.capitalTransfer;
      else if (category) {
        group = { key: `category:${category.id}`, name: category.name };
        kind = 'category';
      } else if (r.debtPayment) group = SYSTEM_EXPENSE_GROUPS.debtPayment;
      else {
        group = NO_CATEGORY_GROUP;
        kind = 'none';
      }

      let g = groups.get(group.key);
      if (!g) {
        g = { ...group, kind, total: 0, count: 0, items: [] };
        groups.set(group.key, g);
      }
      g.total += r.amount;
      g.count += 1;
      g.items.push({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        amount: r.amount,
        person: r.person,
      });

      const month = monthIndex.get(monthKey(r.date.getFullYear(), r.date.getMonth() + 1));
      if (month) month.totals[group.key] = (month.totals[group.key] ?? 0) + r.amount;
    }

    for (const month of months) {
      for (const key of Object.keys(month.totals)) month.totals[key] = roundMoney(month.totals[key]);
    }
    const sortedGroups = [...groups.values()]
      .map(g => ({ ...g, total: roundMoney(g.total), items: g.items.sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.total - a.total);

    return { from, to, months, groups: sortedGroups };
  },
};
