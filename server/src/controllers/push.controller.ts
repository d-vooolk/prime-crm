import { Request, Response } from 'express';
import { z } from 'zod';
import { pushService } from '../services/push.service';
import { parse } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

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
  async test(req: Request, res: Response) {
    if (!pushService.publicKey()) throw new AppError('Пуш-уведомления на сервере не настроены', 400);
    await pushService.sendToUsers([req.user!.id], {
      title: 'Prime CRM',
      body: 'Уведомления работают 👍',
      url: '/settings',
      tag: 'push-test',
    });
    res.json({ success: true });
  },
};
