import { Request, Response } from 'express';
import { z } from 'zod';
import { expensesService, EXPENSE_CATEGORY_NAME_MAX } from '../services/expenses.service';
import { parse } from '../middleware/validate';

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

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате YYYY-MM');
const analyticsQuerySchema = z.object({ from: monthSchema, to: monthSchema });

export const expensesController = {
  async getCategories(_req: Request, res: Response) {
    const data = await expensesService.listCategories();
    res.json({ data });
  },

  async createCategory(req: Request, res: Response) {
    const { name } = parse(categorySchema, req.body);
    const data = await expensesService.createCategory(name);
    res.status(201).json({ data });
  },

  async updateCategory(req: Request, res: Response) {
    const { name } = parse(categorySchema, req.body);
    const data = await expensesService.renameCategory(String(req.params.id), name);
    res.json({ data });
  },

  async deleteCategory(req: Request, res: Response) {
    await expensesService.deleteCategory(String(req.params.id));
    res.status(204).end();
  },

  async getAnalytics(req: Request, res: Response) {
    const { from, to } = parse(analyticsQuerySchema, req.query);
    const data = await expensesService.getAnalytics(from, to);
    res.json({ data });
  },
};
