import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { wikiController } from '../controllers/wiki.controller';
import { AppError } from '../middleware/errorHandler';
import { WIKI_MEDIA_DIR } from '../utils/uploads';

const MAX_FILE_SIZE_MB = 300;

const upload = multer({
  storage: multer.diskStorage({
    destination: WIKI_MEDIA_DIR,
    filename: (_req, file, cb) => {
      const kind = file.mimetype.startsWith('video/') ? 'video' : 'photo';
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${kind}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new AppError('Можно загружать только фото и видео', 400));
  },
});

/** Ошибки multer (размер и т.п.) превращаем в понятный AppError. */
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new AppError(
        err.code === 'LIMIT_FILE_SIZE' ? `Файл больше ${MAX_FILE_SIZE_MB} МБ` : 'Ошибка загрузки файла',
        400,
      ));
      return;
    }
    next(err as Error | undefined);
  });
}

const router = Router();

router.get('/entries', wikiController.listEntries);
router.get('/entry', wikiController.getEntry);
router.put('/entry', wikiController.saveContent);
router.post('/media', uploadSingle, wikiController.uploadMedia);
router.delete('/media/:id', wikiController.deleteMedia);

router.get('/revisions', wikiController.listRevisions);
router.get('/revisions/pending-count', wikiController.pendingCount);
router.post('/revisions/:id/review', wikiController.markReviewed);
router.post('/revisions/:id/reward', wikiController.reward);

router.get('/settings', wikiController.getSettings);
router.patch('/settings', wikiController.updateSettings);

export default router;
