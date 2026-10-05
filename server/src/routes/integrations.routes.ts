import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { vdfOrdersController } from '../controllers/vdfOrders.controller';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

const router = Router();

/** Сравнение за постоянное время — по времени ответа ключ не подобрать */
function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Вход для других наших сайтов. Пользователя здесь нет — запрос подписан общим ключом
 * из .env обеих сторон. Ключ не задан — приём выключен целиком.
 */
function requireIntegrationKey(key: () => string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const expected = key();
    if (!expected) {
      next(new AppError('Приём выключен', 503));
      return;
    }
    const given = req.get('x-integration-key') ?? '';
    if (!safeEqual(given, expected)) {
      next(new AppError('Неверный ключ', 401));
      return;
    }
    next();
  };
}

// Магазин vdf.by: заказы сотрудников для вкладки «VDF» в бухгалтерии
router.post('/vdf/orders', requireIntegrationKey(() => env.vdfIntegrationKey), vdfOrdersController.receive);

export default router;
