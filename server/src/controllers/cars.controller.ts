import { Request, Response } from 'express';
import { carsService } from '../services/cars.service';

export const carsController = {
  async getMarks(req: Request, res: Response) {
    const manualOnly = String(req.query.manualOnly || '') === 'true';
    const data = await carsService.getMarks(manualOnly);
    res.json({ data });
  },

  async getModels(req: Request, res: Response) {
    const data = await carsService.getModels(String(req.params.markId));
    res.json({ data });
  },

  async getGenerations(req: Request, res: Response) {
    const data = await carsService.getGenerations(String(req.params.markId), String(req.params.modelId));
    res.json({ data });
  },

  async createMark(req: Request, res: Response) {
    const data = await carsService.createMark(req.body);
    res.status(201).json({ data });
  },

  async updateMark(req: Request, res: Response) {
    const data = await carsService.updateMark(String(req.params.markId), req.body);
    res.json({ data });
  },

  async deleteMark(req: Request, res: Response) {
    await carsService.deleteMark(String(req.params.markId));
    res.status(204).end();
  },

  async createModel(req: Request, res: Response) {
    const data = await carsService.createModel(String(req.params.markId), req.body);
    res.status(201).json({ data });
  },

  async updateModel(req: Request, res: Response) {
    const data = await carsService.updateModel(String(req.params.markId), String(req.params.modelId), req.body);
    res.json({ data });
  },

  async deleteModel(req: Request, res: Response) {
    await carsService.deleteModel(String(req.params.markId), String(req.params.modelId));
    res.status(204).end();
  },

  async createGeneration(req: Request, res: Response) {
    const data = await carsService.createGeneration(String(req.params.markId), String(req.params.modelId), req.body);
    res.status(201).json({ data });
  },

  async updateGeneration(req: Request, res: Response) {
    const data = await carsService.updateGeneration(
      String(req.params.markId), String(req.params.modelId), String(req.params.generationId), req.body,
    );
    res.json({ data });
  },

  async deleteGeneration(req: Request, res: Response) {
    await carsService.deleteGeneration(
      String(req.params.markId), String(req.params.modelId), String(req.params.generationId),
    );
    res.status(204).end();
  },
};
