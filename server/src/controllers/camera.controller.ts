import { Request, Response } from 'express';
import { z } from 'zod';
import { cameraService } from '../services/camera.service';
import { parse } from '../middleware/validate';
import { isHlsFileName } from '../utils/cameraToken';

const liveParams = z.object({
  token: z.string().min(20).max(2000),
  file: z.string().refine(isHlsFileName, 'Некорректный файл'),
});

/** Камера офиса (services/camera.service.ts) — менеджер и выше */
export const cameraController = {
  async session(req: Request, res: Response) {
    const user = req.user!;
    res.json({ data: await cameraService.session({ id: user.id, isMaster: user.isMaster }) });
  },

  /** Плейлисты и сегменты HLS. Без входа: доступ — по токену просмотра в пути */
  async live(req: Request, res: Response) {
    const { token, file } = parse(liveParams, req.params);
    // Параметры low-latency HLS (_HLS_msn и т.п.) передаём MediaMTX как есть
    const queryIndex = req.originalUrl.indexOf('?');
    const search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const { contentType, body } = await cameraService.fetchHls(token, file, search);
    res.setHeader('Content-Type', contentType);
    // Живое видео: ни браузер, ни nginx не должны его кешировать
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    body.on('error', () => res.destroy());
    req.on('close', () => body.destroy());
    body.pipe(res);
  },
};
