import { Request, Response, NextFunction } from 'express';
import { clientsService } from '../services/clients.service';

export const clientsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const clients = await clientsService.findAll(search);
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
      const client = await clientsService.create(req.body);
      res.status(201).json({ data: client });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientsService.update(String(req.params.id), req.body);
      res.json({ data: client });
    } catch (e) { next(e); }
  },
};
