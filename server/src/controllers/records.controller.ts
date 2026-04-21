import { Request, Response, NextFunction } from 'express';
import { recordsService } from '../services/records.service';
import { smsService } from '../services/sms.service';

export const recordsController = {
  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const records = await recordsService.findByDate(date);
      res.json({ data: records });
    } catch (e) { next(e); }
  },

  async getIncomplete(req: Request, res: Response, next: NextFunction) {
    try {
      const clientDate = req.query.date ? String(req.query.date) : undefined;
      const records = await recordsService.findIncomplete(clientDate);
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

  async sendSms(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.body as { type: 'CAR_READY' | 'REVIEW_REQUEST' };
      await smsService.sendForRecord(String(req.params.id), type);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async searchCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const search = String(req.query.search || '');
      const companies = await recordsService.searchCompanies(search);
      res.json({ data: companies });
    } catch (e) { next(e); }
  },
};
