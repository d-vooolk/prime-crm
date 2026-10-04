import { Request, Response } from 'express';
import { recordMediaService } from '../services/recordMedia.service';
import type { UploadedMedia } from '../utils/mediaUpload';

/** Фото и видео нюансов авто в записи — доступны всем ролям */
export const recordMediaController = {
  async list(req: Request, res: Response) {
    res.json({ data: await recordMediaService.list(String(req.params.id)) });
  },

  async upload(req: Request, res: Response) {
    const media = await recordMediaService.add(String(req.params.id), res.locals.media as UploadedMedia, req.user!);
    res.status(201).json({ data: media });
  },

  async delete(req: Request, res: Response) {
    await recordMediaService.delete(String(req.params.mediaId), req.user!);
    res.json({ success: true });
  },
};
