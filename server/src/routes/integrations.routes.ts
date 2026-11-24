import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { vdfOrdersController } from '../controllers/vdfOrders.controller';
import { vdfCapitalController } from '../controllers/vdfCapital.controller';
import { siteLeadsController } from '../controllers/siteLeads.controller';
import { wikiVdfController } from '../controllers/wikiVdf.controller';
import { mediaUpload } from '../utils/mediaUpload';
import { WIKI_MEDIA_DIR } from '../utils/uploads';
import { panicService } from '../services/panic.service';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { hiddenInLiteMode } from '../utils/liteMode';

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
const vdfKey = requireIntegrationKey(() => env.vdfIntegrationKey);
// В облегчённом режиме (после тревожной кнопки) раздела VDF нет — заказы не принимаются
router.post('/vdf/orders', vdfKey, hiddenInLiteMode, vdfOrdersController.receive);
// Оплаченные и отменённые заказы — для бухгалтерии магазина
router.get('/vdf/states', vdfKey, hiddenInLiteMode, vdfOrdersController.states);
// Валюта, полученная магазином по долгу, — в капитал (в облегчённом режиме капитала нет)
router.post('/vdf/capital', vdfKey, hiddenInLiteMode, vdfCapitalController.receive);
router.delete('/vdf/capital/:ref', vdfKey, hiddenInLiteMode, vdfCapitalController.revoke);
// Вики для оптовиков vdf.by (личный кабинет магазина): просмотр и предложения на проверку.
// Покупателя магазин передаёт в заголовках x-vdf-customer-*; в облегчённом режиме вики нет
const vdfWiki = [vdfKey, hiddenInLiteMode];
const uploadWikiMedia = mediaUpload({ dir: WIKI_MEDIA_DIR, maxPhotoMb: 40, maxVideoMb: 300 });
router.get('/vdf/wiki/entries', vdfWiki, wikiVdfController.entries);
router.get('/vdf/wiki/sections', vdfWiki, wikiVdfController.sections);
router.get('/vdf/wiki/entry', vdfWiki, wikiVdfController.entry);
router.get('/vdf/wiki/proposals', vdfWiki, wikiVdfController.proposals);
router.put('/vdf/wiki/proposal/text', vdfWiki, wikiVdfController.saveText);
router.post('/vdf/wiki/proposal/media', vdfWiki, uploadWikiMedia, wikiVdfController.uploadMedia);
router.delete('/vdf/wiki/proposal/media/:id', vdfWiki, wikiVdfController.removeMedia);
router.post('/vdf/wiki/proposal/products', vdfWiki, wikiVdfController.addProduct);
router.delete('/vdf/wiki/proposal/products/:id', vdfWiki, wikiVdfController.removeProduct);
router.post('/vdf/wiki/proposal/:id/submit', vdfWiki, wikiVdfController.submit);
router.delete('/vdf/wiki/proposal/:id', vdfWiki, wikiVdfController.discard);

// «Протокол AID» из магазина: тот же общий ключ и тот же PIN запускают протокол здесь
router.post('/panic', vdfKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const done = await panicService.trigger(pin, { name: 'интеграция VDF' }, { propagate: false });
    res.json(done ? { data: [], done: true } : { data: [] });
  } catch (error) {
    next(error);
  }
});

// Сайт prime-auto.by: заявки из формы — в раздел «Заявки»
router.post('/site/leads', requireIntegrationKey(() => env.siteLeadsKey), siteLeadsController.receive);

export default router;
