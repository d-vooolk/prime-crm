import { Request, Response } from 'express';
import { z } from 'zod';
import { clientSourcesService, CLIENT_SOURCE_NAME_MAX } from '../services/clientSources.service';
import { parse, requiredText } from '../middleware/validate';

const nameSchema = z.object({
  name: requiredText(CLIENT_SOURCE_NAME_MAX, 'Укажите название источника'),
});
const listQuerySchema = z.object({
  // Со скрытыми — для подписей в старых записях
  all: z.enum(['true', 'false']).optional(),
});
const moveSchema = z.object({
  direction: z.union([z.literal(-1), z.literal(1)]),
});

export const clientSourcesController = {
  async getAll(req: Request, res: Response) {
    const { all } = parse(listQuerySchema, req.query);
    res.json({ data: await clientSourcesService.list(all === 'true') });
  },

  async create(req: Request, res: Response) {
    const { name } = parse(nameSchema, req.body);
    res.status(201).json({ data: await clientSourcesService.create(name) });
  },

  async update(req: Request, res: Response) {
    const { name } = parse(nameSchema, req.body);
    res.json({ data: await clientSourcesService.rename(String(req.params.id), name) });
  },

  async move(req: Request, res: Response) {
    const { direction } = parse(moveSchema, req.body);
    await clientSourcesService.move(String(req.params.id), direction);
    res.json({ success: true });
  },

  async delete(req: Request, res: Response) {
    await clientSourcesService.remove(String(req.params.id));
    res.status(204).end();
  },
};
