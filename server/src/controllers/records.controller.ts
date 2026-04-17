import { Request, Response, NextFunction } from 'express';
import { recordsService } from '../services/records.service';

export const recordsController = {
  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const records = await recordsService.findByDate(date);
      res.json({ data: records });
    } catch (e) { next(e); }
  },

  async getIncomplete(_req: Request, res: Response, next: NextFunction) {
    try {
      const records = await recordsService.findIncomplete();
      res.json({ data: records });
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.findById(String(req.params.id));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.create(req.body);
      res.status(201).json({ data: record });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.update(String(req.params.id), req.body);
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.close(String(req.params.id), req.body);
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.cancel(String(req.params.id));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.restore(String(req.params.id));
      res.json({ data: record });
    } catch (e) { next(e); }
  },
};
