import { Router, Request, Response } from 'express';
import { publicRecordService } from '../services/publicRecord.service';
import { renderGonePage, renderRecordPage } from '../utils/publicRecordPage';

/**
 * Страница записи для клиента без входа. В проде nginx поддомена zapis.prime-auto.by
 * проксирует «/<код>» сюда, а «/api/cars/photo/» и «/api/uploads/repair-types/» — в API
 * (картинки страницы). Пример конфига — .deploy/nginx-zapis.conf.
 */
const router = Router();

function send(res: Response, status: number, html: string) {
  // Только свои картинки и встроенные стили; скриптов на странице нет вовсе
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  // Личные данные: не кешировать и не индексировать
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(status).type('html').send(html);
}

router.get('/:token', async (req: Request, res: Response) => {
  const result = await publicRecordService.getPage(String(req.params.token));
  if (result.kind === 'page') send(res, 200, renderRecordPage(result.view));
  else send(res, 410, renderGonePage(result.view));
});

export default router;
