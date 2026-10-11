import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { RECORD_MEDIA_URL, decodeOriginalName } from '../utils/uploads';
import type { UploadedMedia } from '../utils/mediaUpload';
import type { AuthPayload } from '../middleware/auth.middleware';
import { hasRole, ROLES } from '../utils/roles';
import { logger } from '../utils/logger';
import { optimizePhoto, optimizeVideo, photoQueue, removeMediaFile, videoQueue } from '../utils/recordMediaOptimize';

/** Сколько хранятся фото и видео записи — потом удаляются вместе с файлом */
export const RECORD_MEDIA_TTL_DAYS = 365;

type MediaRow = Awaited<ReturnType<typeof prisma.recordMedia.findMany>>[number];

const withUrl = (m: MediaRow) => ({
  ...m,
  url: `${RECORD_MEDIA_URL}/${m.filename}`,
  thumbUrl: m.thumbFilename ? `${RECORD_MEDIA_URL}/${m.thumbFilename}` : null,
});

const removeFiles = (m: { filename: string; thumbFilename: string | null }) =>
  Promise.all([removeMediaFile(m.filename), removeMediaFile(m.thumbFilename)]);

/**
 * Перекодирование видео в фоне. Пока оно идёт, в карточке показывается «обрабатывается»
 * и открывается оригинал. Файл успели удалить — результат тоже удаляем.
 */
function optimizeVideoInBackground(id: string, filename: string) {
  void videoQueue(async () => {
    try {
      const result = await optimizeVideo(filename);
      const updated = await prisma.recordMedia.updateMany({
        where: { id },
        data: { ...result, processing: false, optimized: true },
      });
      if (updated.count === 0) await removeFiles(result);
    } catch (err) {
      logger.warn('Не удалось перекодировать видео записи — остаётся оригинал', { id, err });
      await prisma.recordMedia.updateMany({ where: { id }, data: { processing: false, optimized: true } });
    }
  });
}

export const recordMediaService = {
  async list(recordId: string) {
    const media = await prisma.recordMedia.findMany({ where: { recordId }, orderBy: { createdAt: 'asc' } });
    return media.map(withUrl);
  },

  async add(recordId: string, upload: UploadedMedia, user: AuthPayload) {
    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) {
      await removeMediaFile(upload.filename);
      throw new AppError('Запись не найдена', 404);
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RECORD_MEDIA_TTL_DAYS);
    const isVideo = upload.kind === 'video';

    // Фото сжимаем сразу (доли секунды); не вышло — сохраняем как есть
    let file = { filename: upload.filename, size: upload.size, thumbFilename: null as string | null };
    if (!isVideo) {
      try {
        file = await photoQueue(() => optimizePhoto(upload.filename));
      } catch (err) {
        logger.warn('Не удалось сжать фото записи — сохраняем оригинал', { err });
      }
    }

    const media = await prisma.recordMedia.create({
      data: {
        recordId,
        type: isVideo ? 'VIDEO' : 'PHOTO',
        ...file,
        originalName: decodeOriginalName(upload.originalName),
        uploadedByName: user.name,
        expiresAt,
        processing: isVideo,
        optimized: !isVideo,
      },
    });
    if (isVideo) optimizeVideoInBackground(media.id, media.filename);
    return withUrl(media);
  },

  /** Удалить может тот, кто загрузил, или менеджер и выше */
  async delete(mediaId: string, user: AuthPayload) {
    const media = await prisma.recordMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new AppError('Файл не найден', 404);
    if (media.uploadedByName !== user.name && !hasRole(user, ROLES.MANAGER)) {
      throw new AppError('Удалить файл может только тот, кто его загрузил, или менеджер', 403);
    }
    await prisma.recordMedia.delete({ where: { id: mediaId } });
    // Видео ещё перекодируется — оригинал удалит фоновая задача, когда закончит
    if (!media.processing) await removeFiles(media);
    else await removeMediaFile(media.thumbFilename);
  },

  /** Файлы записи при её удалении (строки в базе удалятся каскадом) */
  async removeFilesOfRecord(recordId: string) {
    const media = await prisma.recordMedia.findMany({ where: { recordId } });
    await Promise.all(media.map(removeFiles));
  },

  /** Удаление просроченных: запускается при старте сервера и раз в сутки */
  async deleteExpired() {
    const expired = await prisma.recordMedia.findMany({ where: { expiresAt: { lt: new Date() } } });
    for (const m of expired) {
      await prisma.recordMedia.delete({ where: { id: m.id } });
      await removeFiles(m);
    }
    if (expired.length) logger.info('Удалены фото/видео записей старше года', { count: expired.length });
  },

  /**
   * При старте сервера: сжать то, что загружено до появления сжатия, и доделать видео,
   * прерванные перезапуском. Идёт в фоне по одному файлу.
   */
  async resumeOptimization() {
    const pending = await prisma.recordMedia.findMany({ where: { optimized: false }, orderBy: { createdAt: 'desc' } });
    for (const m of pending) {
      if (m.type === 'VIDEO') {
        await prisma.recordMedia.update({ where: { id: m.id }, data: { processing: true } });
        optimizeVideoInBackground(m.id, m.filename);
        continue;
      }
      void photoQueue(async () => {
        try {
          const result = await optimizePhoto(m.filename);
          const updated = await prisma.recordMedia.updateMany({ where: { id: m.id }, data: { ...result, optimized: true } });
          if (updated.count === 0) await removeFiles(result);
        } catch (err) {
          logger.warn('Не удалось сжать старое фото записи', { id: m.id, err });
          await prisma.recordMedia.updateMany({ where: { id: m.id }, data: { optimized: true } });
        }
      });
    }
    if (pending.length) logger.info('Сжатие фото/видео записей запущено', { count: pending.length });
  },
};
