import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { parse } from '../middleware/validate';
import { clientsService } from '../services/clients.service';

// Пустая строка в query = фильтр не задан
const optionalText = (max: number) => z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(max).optional(),
);

const optionalDay = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD').optional(),
);

const listQuerySchema = z.object({
  search: optionalText(100),
  // Телефон принимаем в любом виде, дальше работаем только с цифрами
  phone: optionalText(40).transform(v => {
    const digits = v?.replace(/\D/g, '');
    return digits ? digits : undefined;
  }),
  name: optionalText(100),
  brandId: optionalText(100),
  modelId: optionalText(100),
  generationId: optionalText(100),
  plate: optionalText(20),
  serviceId: optionalText(100),
  from: optionalDay,
  to: optionalDay,
});

const clientCreateSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя клиента').max(200),
  phone: z.string().trim().min(5, 'Укажите телефон').max(40),
  notes: z.preprocess(v => (v === null ? undefined : v), z.string().max(5000).optional()),
});
const clientUpdateSchema = clientCreateSchema.partial();

const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

function parseQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) throw new AppError('Ошибка валидации', 400, result.error.flatten());
  return result.data;
}

export const clientsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = parseQuery(listQuerySchema, req.query);
      const clients = await clientsService.findAll(filter);
      res.json({ data: clients });
    } catch (e) { next(e); }
  },

  async suggest(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = parseQuery(suggestQuerySchema, req.query);
      const clients = await clientsService.suggest(q, limit);
      res.json({ data: clients });
    } catch (e) { next(e); }
  },

  async searchByPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const phone = String(req.query.phone || '');
      const clients = await clientsService.findByPhone(phone);
      res.json({ data: clients });
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientsService.findById(String(req.params.id));
      res.json({ data: client });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientsService.create(parse(clientCreateSchema, req.body));
      res.status(201).json({ data: client });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientsService.update(String(req.params.id), parse(clientUpdateSchema, req.body));
      res.json({ data: client });
    } catch (e) { next(e); }
  },
};
