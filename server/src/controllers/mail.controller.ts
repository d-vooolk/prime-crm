import { Request, Response } from 'express';
import { z } from 'zod';
import { mailService } from '../services/mail.service';
import { parse } from '../middleware/validate';

/** Адрес ящика; пусто — все ящики */
const accountSchema = z.string().trim().max(300).optional();

const listQuery = z.object({
  account: accountSchema,
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(200).optional(),
  unread: z.enum(['1', 'true']).optional(),
});

const readBody = z.object({ isRead: z.boolean() });
const readAllBody = z.object({ account: accountSchema });

/** Почта из ящиков компании (services/mail.service.ts) — только создатель (routes/mail.routes.ts) */
export const mailController = {
  async list(req: Request, res: Response) {
    const q = parse(listQuery, req.query);
    res.json({ data: await mailService.list({
      account: q.account || undefined, page: q.page, pageSize: q.pageSize, q: q.q || undefined, unread: !!q.unread,
    }) });
  },

  async unreadCount(_req: Request, res: Response) {
    res.json({ data: await mailService.unreadCount() });
  },

  async status(_req: Request, res: Response) {
    res.json({ data: await mailService.status() });
  },

  async sync(_req: Request, res: Response) {
    await mailService.syncNow();
    res.json({ data: await mailService.status() });
  },

  async get(req: Request, res: Response) {
    res.json({ data: await mailService.get(String(req.params.id)) });
  },

  async setRead(req: Request, res: Response) {
    const { isRead } = parse(readBody, req.body);
    await mailService.setRead(String(req.params.id), isRead);
    res.json({ success: true });
  },

  async markAllRead(req: Request, res: Response) {
    const { account } = parse(readAllBody, req.body ?? {});
    await mailService.markAllRead(account || undefined);
    res.json({ success: true });
  },

  async moveToSpam(req: Request, res: Response) {
    await mailService.moveToSpam(String(req.params.id));
    res.json({ success: true });
  },

  async delete(req: Request, res: Response) {
    await mailService.delete(String(req.params.id));
    res.json({ success: true });
  },

  /** Вложение: картинки и PDF можно открыть, остальное — только скачать (тип octet-stream) */
  async attachment(req: Request, res: Response) {
    const att = await mailService.attachment(String(req.params.id));
    res.setHeader('Content-Type', att.contentType);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    res.attachment(att.originalName);
    res.sendFile(att.path, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  },
};
