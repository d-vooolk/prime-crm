import { Request, Response } from 'express';
import { z } from 'zod';
import { catalogService } from '../services/catalog.service';
import { parse, requiredText, money, percent } from '../middleware/validate';

const color = z.string().trim().max(30).nullable().optional();

const categoryCreateSchema = z.object({
  name: requiredText(100, 'Укажите название категории'),
  color,
});

const categoryUpdateSchema = z.object({
  name: requiredText(100, 'Укажите название категории').optional(),
  color,
  customPercent: percent.nullable().optional(),
});

const serviceFields = {
  name: requiredText(200, 'Укажите название услуги'),
  categoryId: z.string().min(1, 'Выберите категорию'),
  standardPrice: money('Некорректная цена'),
  estimatedTime: z.coerce.number().int().min(0, 'Некорректное время').max(100000),
  hasEquipment: z.boolean().optional(),
  isProduct: z.boolean().optional(),
  customPercent: percent.nullable().optional(),
};

const serviceCreateSchema = z.object(serviceFields);
const serviceUpdateSchema = z.object(serviceFields).partial();

export const catalogController = {
  async listCategories(_req: Request, res: Response) {
    res.json({ data: await catalogService.listCategories() });
  },

  async createCategory(req: Request, res: Response) {
    const data = parse(categoryCreateSchema, req.body);
    res.status(201).json({ data: await catalogService.createCategory(data) });
  },

  async updateCategory(req: Request, res: Response) {
    const data = parse(categoryUpdateSchema, req.body);
    res.json({ data: await catalogService.updateCategory(String(req.params.id), data) });
  },

  async deleteCategory(req: Request, res: Response) {
    await catalogService.deleteCategory(String(req.params.id));
    res.json({ success: true });
  },

  async createService(req: Request, res: Response) {
    const data = parse(serviceCreateSchema, req.body);
    res.status(201).json({ data: await catalogService.createService(data) });
  },

  async updateService(req: Request, res: Response) {
    const data = parse(serviceUpdateSchema, req.body);
    res.json({ data: await catalogService.updateService(String(req.params.id), data) });
  },

  async deleteService(req: Request, res: Response) {
    await catalogService.deactivateService(String(req.params.id));
    res.json({ success: true });
  },
};
