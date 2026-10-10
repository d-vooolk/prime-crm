import { Request, Response } from 'express';
import { z } from 'zod';
import { repairTypesService } from '../services/repairTypes.service';
import { parse, requiredText } from '../middleware/validate';
import type { UploadedMedia } from '../utils/mediaUpload';

const faqItem = z.object({
  question: requiredText(300, 'Укажите вопрос'),
  answer: requiredText(3000, 'Укажите ответ'),
});

const link = z.object({
  title: requiredText(100, 'Укажите текст ссылки'),
  // Ссылки показываются клиенту: только http(s), чтобы не подсунуть javascript: и прочее
  url: z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, 'Ссылка должна начинаться с http:// или https://'),
});

const fields = {
  name: requiredText(100, 'Укажите название'),
  description: z.string().trim().max(5000).optional(),
  faq: z.array(faqItem).max(30).optional(),
  links: z.array(link).max(10).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).nullable().optional(),
};

const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();

/** Типы ремонта для страницы записи клиента. Читают все, меняют — от менеджера (routes) */
export const repairTypesController = {
  async list(_req: Request, res: Response) {
    res.json({ data: await repairTypesService.list() });
  },

  async create(req: Request, res: Response) {
    res.status(201).json({ data: await repairTypesService.create(parse(createSchema, req.body)) });
  },

  async update(req: Request, res: Response) {
    res.json({ data: await repairTypesService.update(String(req.params.id), parse(updateSchema, req.body)) });
  },

  async delete(req: Request, res: Response) {
    await repairTypesService.delete(String(req.params.id));
    res.json({ success: true });
  },

  async addPhoto(req: Request, res: Response) {
    const photo = await repairTypesService.addPhoto(String(req.params.id), res.locals.media as UploadedMedia);
    res.status(201).json({ data: photo });
  },

  async deletePhoto(req: Request, res: Response) {
    await repairTypesService.deletePhoto(String(req.params.id), String(req.params.photoId));
    res.json({ success: true });
  },
};
