import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { canWatch } from './camera.service';
import { ArchiveFile, exportDurationSeconds, exportFileName, pickFilesToDelete } from './cameraArchive.logic';

/**
 * Архив камеры офиса. MediaMTX сам пишет поток кусками по 10 минут (.deploy/mediamtx.yml →
 * record), отдаёт список записей и склеивает промежуток в MP4 (playback, порт 9996 внутри
 * docker-сети). Сервер проверяет права и следит за объёмом (CAMERA_ARCHIVE_MAX_GB).
 */
const PATH = 'office';

export interface ArchiveRange {
  start: string;
  end: string;
}

async function listFiles(dir: string): Promise<ArchiveFile[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: ArchiveFile[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
      const stat = await fs.stat(full);
      files.push({ path: full, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
  return files;
}

export const cameraArchiveService = {
  /** Промежутки, за которые есть запись (MediaMTX склеивает соседние куски в один) */
  async list(): Promise<ArchiveRange[]> {
    let res: Response;
    try {
      res = await fetch(`${env.cameraPlaybackUrl}/list?path=${PATH}`, { signal: AbortSignal.timeout(5000) });
    } catch (e) {
      logger.warn('Архив камеры: MediaMTX не отвечает', { err: e });
      throw new AppError('Архив камеры недоступен', 503);
    }
    // 404 — записей ещё нет
    if (res.status === 404) return [];
    if (!res.ok) throw new AppError('Архив камеры недоступен', 502);
    const items = await res.json() as { start: string; duration: number }[];
    return items.map(i => ({
      start: i.start,
      end: new Date(new Date(i.start).getTime() + i.duration * 1000).toISOString(),
    }));
  },

  /** Промежуток архива одним MP4. Доступ — по токену просмотра, как у живого видео */
  async exportRange(token: string, start: Date, end: Date) {
    if (!(await canWatch(token))) throw new AppError('Доступ к камере закрыт', 401);
    const duration = exportDurationSeconds(start, end);
    if (duration == null) throw new AppError('Некорректный промежуток: не больше суток, конец позже начала', 400);

    const url = `${env.cameraPlaybackUrl}/get?path=${PATH}&start=${encodeURIComponent(start.toISOString())}`
      + `&duration=${duration}&format=mp4`;
    let upstream: Response;
    try {
      upstream = await fetch(url);
    } catch (e) {
      logger.warn('Архив камеры: MediaMTX не отвечает', { err: e });
      throw new AppError('Архив камеры недоступен', 503);
    }
    if (upstream.status === 404) throw new AppError('За этот промежуток записи нет', 404);
    if (!upstream.ok || !upstream.body) throw new AppError('Не удалось получить запись', 502);
    return {
      fileName: exportFileName(start),
      body: Readable.fromWeb(upstream.body as unknown as WebReadableStream),
    };
  },

  /** Удаляет самые старые записи сверх лимита. Запускается по таймеру (index.ts) */
  async enforceLimit(): Promise<void> {
    const dir = env.cameraRecordingsDir;
    if (!dir) return;
    const toDelete = pickFilesToDelete(await listFiles(dir), env.cameraArchiveMaxBytes);
    for (const file of toDelete) {
      await fs.rm(file.path, { force: true });
    }
    if (toDelete.length > 0) {
      const freed = toDelete.reduce((sum, f) => sum + f.size, 0);
      logger.info('Архив камеры: удалены старые записи сверх лимита', {
        files: toDelete.length,
        freedMb: Math.round(freed / 1024 / 1024),
      });
    }
  },
};
