import { Router } from 'express';
import { cameraController } from '../controllers/camera.controller';

/**
 * Видео камеры для плеера и выгрузка архива. Подключается до authMiddleware: плеер
 * (особенно на iPhone) и ссылка «Скачать» не умеют добавлять заголовок Authorization,
 * доступ — по токену просмотра в пути (utils/cameraToken.ts), роль проверяет cameraService.
 * Остальные /api/camera/* проходят дальше — к camera.routes.ts с обычной проверкой входа.
 */
const router = Router();

router.get('/live/:token/:file', cameraController.live);
router.get('/archive-file/:token/camera.mp4', cameraController.archiveFile);

export default router;
