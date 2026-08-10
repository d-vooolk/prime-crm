import { Request, Response } from 'express';
import { carsService } from '../services/cars.service';

export const carsController = {
  async getMarks(_req: Request, res: Response) {
    const data = await carsService.getMarks();
    res.json({ data });
  },

  async getModels(req: Request, res: Response) {
    const data = await carsService.getModels(String(req.params.markId));
    res.json({ data });
  },

  async getGenerations(req: Request, res: Response) {
    const data = await carsService.getGenerations(
      String(req.params.markId),
      String(req.params.modelId),
    );
    res.json({ data });
  },
};
