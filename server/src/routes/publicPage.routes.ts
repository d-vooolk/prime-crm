import fs from 'fs';
import path from 'path';
import express, { Router, Request, Response } from 'express';
import { publicRecordService } from '../services/publicRecord.service';
import { renderGonePage, renderRecordPage } from '../utils/publicRecordPage';
import { logger } from '../utils/logger';

/**
 * Страница записи для клиента без входа. В проде nginx поддомена zapis.prime-auto.by
 * проксирует «/<код>», «/<код>/calendar.ics» и «/assets/…» сюда, а «/api/cars/photo/» и
 * «/api/uploads/repair-types/» — в API (картинки страницы). Конфиг — .deploy/nginx-zapis.conf.
 */
const router = Router();

// Логотип и шрифт — server/assets/record-page (в образе /app/assets)
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets', 'record-page');

/** Логотип встраивается в страницу целиком: без лишнего запроса и без мигания */
const LOGO_SVG = (() => {
  try {
    return fs.readFileSync(path.join(ASSETS_DIR, 'logo.svg'), 'utf8')
      .replace(/<\?xml[^>]*>/, '')
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace('<svg', '<svg role="img" aria-label="Prime Auto"')
      .trim();
  } catch (err) {
    logger.warn('Страница записи: нет логотипа', { err });
    return '<b>PRIME AUTO</b>';
  }
})();

function send(res: Response, status: number, html: string) {
  // Только свои картинки, шрифт и встроенные стили; скриптов на странице нет вовсе
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  // Личные данные: не кешировать и не индексировать
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(status).type('html').send(html);
}

router.use('/assets', express.static(ASSETS_DIR, { maxAge: '30d', index: false, dotfiles: 'deny' }));

router.get('/:token/calendar.ics', async (req: Request, res: Response) => {
  const ics = await publicRecordService.getCalendar(String(req.params.token));
  if (!ics) { send(res, 410, renderGonePage({ logoSvg: LOGO_SVG })); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // inline: iPhone сразу предлагает «Добавить в Календарь», Android открывает приложение календаря
  res.setHeader('Content-Disposition', 'inline; filename="prime-auto.ics"');
  res.type('text/calendar; charset=utf-8').send(ics);
});

router.get('/:token', async (req: Request, res: Response) => {
  const view = await publicRecordService.getPage(String(req.params.token), LOGO_SVG);
  if (view) send(res, 200, renderRecordPage(view));
  else send(res, 410, renderGonePage({ logoSvg: LOGO_SVG }));
});

export default router;
