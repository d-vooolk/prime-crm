import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { RECORD_MEDIA_DIR, RECORD_MEDIA_URL, decodeOriginalName } from '../utils/uploads';
import type { UploadedMedia } from '../utils/mediaUpload';
import type { AuthPayload } from '../middleware/auth.middleware';
import { hasRole, ROLES } from '../utils/roles';
import { logger } from '../utils/logger';

/** Сколько хранятся фото и видео записи — потом удаляются вместе с файлом */
export const RECORD_MEDIA_TTL_DAYS = 365;

const removeFile = (filename: string) =>
  fs.promises.unlink(path.join(RECORD_MEDIA_DIR, filename)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') logger.warn('Не удалось удалить файл записи', { filename, err });
  });

type MediaRow = Awaited<ReturnType<typeof prisma.recordMedia.findMany>>[number];

const withUrl = (m: MediaRow) => ({ ...m, url: `${RECORD_MEDIA_URL}/${m.filename}` });

export const recordMediaService = {
  async list(recordId: string) {
    const media = await prisma.recordMedia.findMany({ where: { recordId }, orderBy: { createdAt: 'asc' } });
    return media.map(withUrl);
  },

  async add(recordId: string, upload: UploadedMedia, user: AuthPayload) {
    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) {
      await removeFile(upload.filename);
      throw new AppError('Запись не найдена', 404);
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RECORD_MEDIA_TTL_DAYS);
    const media = await prisma.recordMedia.create({
      data: {
        recordId,
        type: upload.kind === 'video' ? 'VIDEO' : 'PHOTO',
        filename: upload.filename,
        originalName: decodeOriginalName(upload.originalName),
        size: upload.size,
        uploadedByName: user.name,
        expiresAt,
      },
    });
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
    await removeFile(media.filename);
  },

  /** Файлы записи при её удалении (строки в базе удалятся каскадом) */
  async removeFilesOfRecord(recordId: string) {
    const media = await prisma.recordMedia.findMany({ where: { recordId }, select: { filename: true } });
    await Promise.all(media.map(m => removeFile(m.filename)));
  },

  /** Удаление просроченных: запускается при старте сервера и раз в сутки */
  async deleteExpired() {
    const expired = await prisma.recordMedia.findMany({ where: { expiresAt: { lt: new Date() } } });
    for (const m of expired) {
      await prisma.recordMedia.delete({ where: { id: m.id } });
      await removeFile(m.filename);
    }
    if (expired.length) logger.info('Удалены фото/видео записей старше года', { count: expired.length });
  },
};
