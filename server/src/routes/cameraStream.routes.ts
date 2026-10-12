import { Router } from 'express';
import { cameraController } from '../controllers/camera.controller';

/**
 * Видео камеры для плеера. Подключается до authMiddleware: плеер (особенно на iPhone)
 * не умеет добавлять заголовок Authorization, доступ — по токену просмотра в пути
 * (utils/cameraToken.ts), роль проверяет cameraService.
 */
const router = Router();

router.get('/:token/:file', cameraController.live);

export default router;
