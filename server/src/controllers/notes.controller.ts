import { Request, Response } from 'express';
import { notesService } from '../services/notes.service';

const CREATOR_ROLES = ['Создатель'];

function isCreator(req: Request): boolean {
  return (req.user?.isMaster || CREATOR_ROLES.includes(req.user?.role || ''));
}

export const notesController = {
  async getAll(req: Request, res: Response) {
    const requesterId = req.user!.id;
    const canViewAll = isCreator(req);
    const targetId = (canViewAll && req.query.servicemanId)
      ? String(req.query.servicemanId)
      : requesterId;
    const archive = req.query.archive === 'true';
    const notes = await notesService.getAll(targetId, archive);
    res.json({ data: notes });
  },

  async create(req: Request, res: Response) {
    const requesterId = req.user!.id;
    const creator = isCreator(req);
    const { text, date, allDay, time, repeat, priority, servicemanId } = req.body;
    const targetServicemanId = (creator && servicemanId) ? servicemanId : requesterId;
    const note = await notesService.create(targetServicemanId, {
      text,
      date: date ?? null,
      allDay: allDay ?? true,
      time: time ?? null,
      repeat: repeat ?? null,
      priority: priority ?? 'MEDIUM',
    });
    res.status(201).json({ data: note });
  },

  async update(req: Request, res: Response) {
    const id = req.params.id;
    const requesterId = req.user!.id;
    const creator = isCreator(req);
    try {
      const note = await notesService.update(id, requesterId, creator, req.body);
      res.json({ data: note });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === '404') { res.status(404).json({ message: 'Not found' }); return; }
      if (code === '403') { res.status(403).json({ message: 'Forbidden' }); return; }
      throw err;
    }
  },

  async delete(req: Request, res: Response) {
    const id = req.params.id;
    const requesterId = req.user!.id;
    const creator = isCreator(req);
    try {
      await notesService.delete(id, requesterId, creator);
      res.json({ data: { ok: true } });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === '404') { res.status(404).json({ message: 'Not found' }); return; }
      if (code === '403') { res.status(403).json({ message: 'Forbidden' }); return; }
      throw err;
    }
  },
};
