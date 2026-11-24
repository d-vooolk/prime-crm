import { Request, Response } from 'express';
import { z } from 'zod';
import { tasksService } from '../services/tasks.service';
import { parse, requiredText, id } from '../middleware/validate';

const listSchema = z.object({ tab: z.enum(['mine', 'given', 'done']).default('mine') });
const createSchema = z.object({
  text: requiredText(5000, 'Напишите задание'),
  assigneeId: id,
});
const updateSchema = createSchema;
const doneSchema = z.object({ done: z.boolean() });

export const tasksController = {
  async list(req: Request, res: Response) {
    const { tab } = parse(listSchema, req.query);
    res.json({ data: await tasksService.list(tab, req.user!) });
  },

  async mineCount(req: Request, res: Response) {
    res.json({ data: { count: await tasksService.mineCount(req.user!) } });
  },

  async assignees(_req: Request, res: Response) {
    res.json({ data: await tasksService.assignees() });
  },

  async create(req: Request, res: Response) {
    res.status(201).json({ data: await tasksService.create(parse(createSchema, req.body), req.user!) });
  },

  async update(req: Request, res: Response) {
    res.json({ data: await tasksService.update(parse(id, req.params.id), parse(updateSchema, req.body), req.user!) });
  },

  async setDone(req: Request, res: Response) {
    const { done } = parse(doneSchema, req.body);
    res.json({ data: await tasksService.setDone(parse(id, req.params.id), done, req.user!) });
  },

  async delete(req: Request, res: Response) {
    await tasksService.delete(parse(id, req.params.id), req.user!);
    res.json({ data: { ok: true } });
  },
};
