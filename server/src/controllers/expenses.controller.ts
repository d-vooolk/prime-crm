import { Request, Response } from 'express';
import { z } from 'zod';
import { expensesService, EXPENSE_CATEGORY_NAME_MAX } from '../services/expenses.service';
import { AppError } from '../middleware/errorHandler';

const ROLE_LEVEL: Record<string, number> = {
  'Создатель': 1, 'Директор': 2, 'Менеджер': 3, 'Сотрудник': 4,
};
const requesterLevel = (req: Request) => {
  if (!req.user) return 99;
  if (req.user.isMaster) return 0;
  return ROLE_LEVEL[req.user.role ?? ''] ?? 99;
};

// Справочник категорий правят все, кроме сотрудников
function assertCanEditCategories(req: Request) {
  if (requesterLevel(req) > ROLE_LEVEL['Менеджер']) {
    throw new AppError('Недостаточно прав', 403);
  }
}

// Аналитика расходов — только создатель (и мастер-аккаунт)
function assertCreator(req: Request) {
  if (requesterLevel(req) > ROLE_LEVEL['Создатель']) {
    throw new AppError('Недостаточно прав', 403);
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message || 'Ошибка валидации', 400, result.error.flatten());
  }
  return result.data;
}

const categorySchema = z.object({
  name: z.string().trim()
    .min(1, 'Укажите название категории')
    .max(EXPENSE_CATEGORY_NAME_MAX, `Название — не длиннее ${EXPENSE_CATEGORY_NAME_MAX} символов`),
});

// Поле «Категория» в формах расхода кассы: название (новое создаётся), null/'' — без категории
const expenseCategoryFieldSchema = z.string()
  .max(EXPENSE_CATEGORY_NAME_MAX, `Название категории — не длиннее ${EXPENSE_CATEGORY_NAME_MAX} символов`)
  .nullable()
  .optional();
export const parseExpenseCategoryField = (value: unknown): string | null | undefined =>
  parse(expenseCategoryFieldSchema, value);

const monthSchema =z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате YYYY-MM');
const analyticsQuerySchema = z.object({ from: monthSchema, to: monthSchema });

export const expensesController = {
  async getCategories(_req: Request, res: Response) {
    const data = await expensesService.listCategories();
    res.json({ data });
  },

  async createCategory(req: Request, res: Response) {
    assertCanEditCategories(req);
    const { name } = parse(categorySchema, req.body);
    const data = await expensesService.createCategory(name);
    res.status(201).json({ data });
  },

  async updateCategory(req: Request, res: Response) {
    assertCanEditCategories(req);
    const { name } = parse(categorySchema, req.body);
    const data = await expensesService.renameCategory(String(req.params.id), name);
    res.json({ data });
  },

  async deleteCategory(req: Request, res: Response) {
    assertCanEditCategories(req);
    await expensesService.deleteCategory(String(req.params.id));
    res.status(204).end();
  },

  async getAnalytics(req: Request, res: Response) {
    assertCreator(req);
    const { from, to } = parse(analyticsQuerySchema, req.query);
    const data = await expensesService.getAnalytics(from, to);
    res.json({ data });
  },
};
