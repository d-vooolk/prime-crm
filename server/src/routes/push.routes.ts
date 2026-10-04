import { Router } from 'express';
import { pushController } from '../controllers/push.controller';

const router = Router();

// Подписка на уведомления — для любой роли, каждый получает только свои
router.get('/public-key', pushController.publicKey);
router.post('/subscribe', pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);
router.post('/test', pushController.test);

export default router;
