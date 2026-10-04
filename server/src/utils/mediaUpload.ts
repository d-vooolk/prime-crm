import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler';
import { MediaKind, mediaKind, sniffMediaFile } from './uploads';

/** Что загрузилось: итоговое имя файла в каталоге и вид по содержимому */
export interface UploadedMedia {
  filename: string;
  kind: MediaKind;
  size: number;
  originalName: string;
}

interface Options {
  dir: string;
  maxPhotoMb: number;
  maxVideoMb: number;
}

const removeQuietly = (filePath: string) => fs.promises.unlink(filePath).catch(() => undefined);

/**
 * Загрузка одного фото или видео (поле file). Файл сначала сохраняется под временным именем,
 * затем проверяется по содержимому: не фото/видео — удаляется с ошибкой 400. Итоговое имя
 * случайное, расширение — по настоящему формату. Результат — в res.locals.media.
 */
export function mediaUpload({ dir, maxPhotoMb, maxVideoMb }: Options) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, _file, cb) => cb(null, `tmp-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`),
    }),
    limits: { fileSize: Math.max(maxPhotoMb, maxVideoMb) * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (mediaKind(file)) cb(null, true);
      else cb(new AppError('Можно загружать только фото и видео', 400));
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, async (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(new AppError(
          err.code === 'LIMIT_FILE_SIZE' ? `Файл больше ${Math.max(maxPhotoMb, maxVideoMb)} МБ` : 'Ошибка загрузки файла',
          400,
        ));
        return;
      }
      if (err) { next(err); return; }
      const file = req.file;
      if (!file) { next(new AppError('Файл не загружен', 400)); return; }
      try {
        const detected = await sniffMediaFile(file.path);
        if (!detected) {
          await removeQuietly(file.path);
          throw new AppError('Файл не похож на фото или видео', 400);
        }
        if (detected.kind === 'photo' && file.size > maxPhotoMb * 1024 * 1024) {
          await removeQuietly(file.path);
          throw new AppError(`Фото больше ${maxPhotoMb} МБ`, 400);
        }
        const filename = `${detected.kind}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${detected.ext}`;
        await fs.promises.rename(file.path, path.join(dir, filename));
        const media: UploadedMedia = { filename, kind: detected.kind, size: file.size, originalName: file.originalname };
        res.locals.media = media;
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}
