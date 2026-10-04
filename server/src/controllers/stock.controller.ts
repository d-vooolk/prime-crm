import { Request, Response } from 'express';
import { z } from 'zod';
import { stockService } from '../services/stock.service';
import { parse, requiredText, nullableText, optionalText, money } from '../middleware/validate';

const qty = (message: string) => z.coerce.number({ invalid_type_error: message }).finite(message).min(0, message).max(1e9, message);

const categorySchema = z.object({
  name: requiredText(100, 'Укажите название категории'),
  parentId: z.preprocess(v => (v === '' ? null : v), z.string().max(100).nullable().default(null)),
});
const categoryUpdateSchema = z.object({
  name: requiredText(100, 'Укажите название категории').optional(),
  parentId: z.preprocess(v => (v === '' ? null : v), z.string().max(100).nullable().optional()),
});

const itemFields = {
  categoryId: z.string().min(1, 'Выберите категорию'),
  name: requiredText(200, 'Укажите название товара'),
  sku: nullableText(100),
  unit: z.string().trim().min(1).max(20).optional(),
  minQuantity: qty('Некорректный порог').nullable().optional(),
  purchasePrice: money('Некорректная цена').nullable().optional(),
  notes: nullableText(2000),
};
const itemCreateSchema = z.object({ ...itemFields, quantity: qty('Некорректный остаток').optional() });
const itemUpdateSchema = z.object(itemFields).partial();

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUST'], { errorMap: () => ({ message: 'Неизвестный тип движения' }) }),
  quantity: qty('Некорректное количество'),
  comment: nullableText(500),
}).refine(m => m.type === 'ADJUST' || m.quantity > 0, { message: 'Количество должно быть больше нуля', path: ['quantity'] });

const listQuerySchema = z.object({
  categoryId: optionalText(100),
  q: optionalText(100),
  low: z.enum(['true', 'false']).optional(),
});

export const stockController = {
  async listCategories(_req: Request, res: Response) {
    res.json({ data: await stockService.listCategories() });
  },

  async createCategory(req: Request, res: Response) {
    const { name, parentId } = parse(categorySchema, req.body);
    res.status(201).json({ data: await stockService.createCategory(name, parentId) });
  },

  async updateCategory(req: Request, res: Response) {
    const data = parse(categoryUpdateSchema, req.body);
    res.json({ data: await stockService.updateCategory(String(req.params.id), data) });
  },

  async deleteCategory(req: Request, res: Response) {
    await stockService.deleteCategory(String(req.params.id));
    res.json({ success: true });
  },

  async listItems(req: Request, res: Response) {
    const { categoryId, q, low } = parse(listQuerySchema, req.query);
    res.json({ data: await stockService.listItems({ categoryId, q, lowOnly: low === 'true' }) });
  },

  async lowCount(_req: Request, res: Response) {
    res.json({ data: { count: await stockService.lowStockCount() } });
  },

  async createItem(req: Request, res: Response) {
    const data = parse(itemCreateSchema, req.body);
    res.status(201).json({ data: await stockService.createItem(data, req.user?.name) });
  },

  async updateItem(req: Request, res: Response) {
    const data = parse(itemUpdateSchema, req.body);
    res.json({ data: await stockService.updateItem(String(req.params.id), data) });
  },

  async deleteItem(req: Request, res: Response) {
    await stockService.deleteItem(String(req.params.id));
    res.json({ success: true });
  },

  async move(req: Request, res: Response) {
    const data = parse(movementSchema, req.body);
    res.json({ data: await stockService.move(String(req.params.id), data, req.user?.name) });
  },

  async movements(req: Request, res: Response) {
    res.json({ data: await stockService.movements(String(req.params.id)) });
  },
};
