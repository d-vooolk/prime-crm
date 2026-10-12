import { Request, Response } from 'express';
import { z } from 'zod';
import { cameraService } from '../services/camera.service';
import { cameraArchiveService } from '../services/cameraArchive.service';
import { parse } from '../middleware/validate';
import { isHlsFileName } from '../utils/cameraToken';

const liveParams = z.object({
  token: z.string().min(20).max(2000),
  file: z.string().refine(isHlsFileName, 'Некорректный файл'),
});

const archiveFileParams = z.object({
  token: z.string().min(20).max(2000),
});

const archiveFileQuery = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  /** 1 — смотреть в браузере, иначе — скачать файлом */
  inline: z.enum(['1']).optional(),
});

/** Камера офиса (services/camera.service.ts) — менеджер и выше */
export const cameraController = {
  async session(req: Request, res: Response) {
    const user = req.user!;
    res.json({ data: await cameraService.session({ id: user.id, isMaster: user.isMaster }) });
  },

  async archive(_req: Request, res: Response) {
    res.json({ data: await cameraArchiveService.list() });
  },

  /** Промежуток архива одним MP4. Без входа: доступ — по токену просмотра в пути */
  async archiveFile(req: Request, res: Response) {
    const { token } = parse(archiveFileParams, req.params);
    const q = parse(archiveFileQuery, req.query);
    const { fileName, body } = await cameraArchiveService.exportRange(token, new Date(q.start), new Date(q.end));
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `${q.inline ? 'inline' : 'attachment'}; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    body.on('error', () => res.destroy());
    req.on('close', () => body.destroy());
    body.pipe(res);
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
