import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { mailController } from '../controllers/mail.controller';
import { requireRole } from '../middleware/requireRole';
import { ROLES } from '../utils/roles';
import { AppError } from '../middleware/errorHandler';

/** Вложения письма из CRM: в памяти, всего не больше 18 МБ (внешний nginx пропускает до 20) */
const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_MB = 18;
const upload = multer({
  storage: multer.memoryStorage(),
  // Имена файлов приходят в UTF-8 (по умолчанию multer читает их как latin1 — кириллица ломалась)
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_TOTAL_MB * 1024 * 1024, files: MAX_ATTACHMENTS },
});

function sendUpload(req: Request, res: Response, next: NextFunction) {
  upload.array('files', MAX_ATTACHMENTS)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new AppError(
        err.code === 'LIMIT_FILE_SIZE' ? `Вложения больше ${MAX_TOTAL_MB} МБ`
          : err.code === 'LIMIT_FILE_COUNT' ? `Не больше ${MAX_ATTACHMENTS} вложений` : 'Ошибка загрузки вложений',
        400,
      ));
      return;
    }
    if (err) { next(err); return; }
    const total = ((req.files as Express.Multer.File[] | undefined) ?? []).reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_MB * 1024 * 1024) { next(new AppError(`Вложения больше ${MAX_TOTAL_MB} МБ`, 400)); return; }
    next();
  });
}

const router = Router();
// Почту компании видит только создатель (и мастер-доступ)
router.use(requireRole(ROLES.CREATOR));

router.get('/', mailController.list);
router.get('/unread-count', mailController.unreadCount);
router.get('/status', mailController.status);
router.post('/sync', mailController.sync);
router.post('/read-all', mailController.markAllRead);
router.post('/send', sendUpload, mailController.send);
router.get('/attachments/:id', mailController.attachment);
router.get('/:id', mailController.get);
router.patch('/:id', mailController.setRead);
router.post('/:id/spam', mailController.moveToSpam);
router.delete('/:id', mailController.delete);

export default router;
