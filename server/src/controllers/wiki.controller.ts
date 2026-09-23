import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { wikiService, isWikiReviewer, WikiKey } from '../services/wiki.service';
import { decodeOriginalName, mediaKind } from '../utils/uploads';

const keySchema = z.object({
  markId: z.string().min(1),
  modelId: z.string().min(1),
  generationId: z.string().min(1),
});

function parseKey(source: unknown): WikiKey {
  const result = keySchema.safeParse(source);
  if (!result.success) throw new AppError('Не выбран автомобиль', 400, result.error.flatten());
  return result.data;
}

function requireReviewer(req: Request) {
  if (!isWikiReviewer(req.user!)) throw new AppError('Недостаточно прав', 403);
}

export const wikiController = {
  async getEntry(req: Request, res: Response) {
    const entry = await wikiService.getEntry(parseKey(req.query));
    res.json({ data: entry });
  },

  async listEntries(_req: Request, res: Response) {
    res.json({ data: await wikiService.listEntries() });
  },

  async saveContent(req: Request, res: Response) {
    const { content, ...key } = req.body as Record<string, unknown>;
    if (typeof content !== 'string') throw new AppError('Нет текста', 400);
    const entry = await wikiService.saveContent(parseKey(key), content, req.user!);
    res.json({ data: entry });
  },

  async uploadMedia(req: Request, res: Response) {
    const file = req.file;
    if (!file) throw new AppError('Файл не загружен', 400);
    let key: WikiKey;
    try {
      key = parseKey(req.body);
    } catch (e) {
      fs.promises.unlink(file.path).catch(() => {});
      throw e;
    }
    const media = await wikiService.addMedia(key, {
      filename: path.basename(file.filename),
      originalName: decodeOriginalName(file.originalname),
      size: file.size,
      type: mediaKind(file) === 'video' ? 'VIDEO' : 'PHOTO',
    }, req.user!);
    res.status(201).json({ data: media });
  },

  async deleteMedia(req: Request, res: Response) {
    await wikiService.deleteMedia(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  },

  async pendingCount(req: Request, res: Response) {
    const count = isWikiReviewer(req.user!) ? await wikiService.pendingCount() : 0;
    res.json({ data: { count } });
  },

  async listRevisions(req: Request, res: Response) {
    requireReviewer(req);
    const status = req.query.status === 'DONE' ? 'DONE' : 'PENDING';
    res.json({ data: await wikiService.listRevisions(status) });
  },

  async markReviewed(req: Request, res: Response) {
    requireReviewer(req);
    await wikiService.markReviewed(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  },

  async reward(req: Request, res: Response) {
    requireReviewer(req);
    await wikiService.reward(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  },

  async getSettings(_req: Request, res: Response) {
    res.json({ data: await wikiService.getSettings() });
  },

  async updateSettings(req: Request, res: Response) {
    requireReviewer(req);
    const result = z.object({ bonusAmount: z.number().min(0) }).safeParse(req.body);
    if (!result.success) throw new AppError('Некорректный размер премии', 400);
    res.json({ data: await wikiService.updateSettings(result.data) });
  },
};
