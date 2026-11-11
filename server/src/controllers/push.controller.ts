import { Request, Response } from 'express';
import { z } from 'zod';
import { pushService } from '../services/push.service';
import { parse } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { recentPushes } from '../utils/recentPushes';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

export const pushController = {
  /** Публичный ключ VAPID для подписки в браузере; null — пуши на сервере не настроены */
  async publicKey(_req: Request, res: Response) {
    res.json({ data: { publicKey: pushService.publicKey() } });
  },

  async subscribe(req: Request, res: Response) {
    const { endpoint, keys } = parse(subscriptionSchema, req.body);
    await pushService.subscribe(req.user!, { endpoint, ...keys }, req.get('user-agent')?.slice(0, 300));
    res.json({ success: true });
  },

  async unsubscribe(req: Request, res: Response) {
    const { endpoint } = parse(z.object({ endpoint: z.string().max(2000) }), req.body);
    await pushService.unsubscribe(endpoint);
    res.json({ success: true });
  },

  /** Проверочное уведомление себе на все свои устройства */
  /**
   * Последний пуш, пришедший пользователю, пока приложение было свёрнуто (hiddenFor — сколько мс).
   * Время считается от часов сервера: часы телефона могут расходиться
   */
  async recent(req: Request, res: Response) {
    const { hiddenFor } = parse(z.object({ hiddenFor: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000) }), req.query);
    const now = Date.now();
    const push = recentPushes.latestSince(req.user!.id, now - hiddenFor, now);
    res.json({ data: push && { id: push.id, url: push.url, title: push.title, body: push.body, ageMs: now - push.at } });
  },

  async test(req: Request, res: Response) {
    if (!pushService.publicKey()) throw new AppError('Пуш-уведомления на сервере не настроены', 400);
    // Через 5 секунд: успеть свернуть приложение и проверить переход по нажатию из фона
    const userId = req.user!.id;
    setTimeout(() => {
      pushService.sendToUsers([userId], {
        title: 'Prime CRM',
        body: 'Уведомления работают 👍 Нажмите — откроется расписание',
        url: '/schedule',
        tag: 'push-test',
      }).catch((err: unknown) => logger.error('Проверочный пуш не отправлен', { err }));
    }, 5000);
    res.json({ success: true });
  },
};
