import { Request, Response } from 'express';
import { z } from 'zod';
import { contactsService } from '../services/contacts.service';
import { parse, requiredText, nullableText, id } from '../middleware/validate';

const createSchema = z.object({
  name: requiredText(200, 'Укажите название'),
  phone: nullableText(100),
  comment: nullableText(5000),
});

const updateSchema = createSchema.partial();

export const contactsController = {
  async list(_req: Request, res: Response) {
    res.json({ data: await contactsService.list() });
  },

  async create(req: Request, res: Response) {
    res.status(201).json({ data: await contactsService.create(parse(createSchema, req.body)) });
  },

  async update(req: Request, res: Response) {
    res.json({ data: await contactsService.update(parse(id, req.params.id), parse(updateSchema, req.body)) });
  },

  async delete(req: Request, res: Response) {
    await contactsService.delete(parse(id, req.params.id));
    res.json({ data: { ok: true } });
  },
};
