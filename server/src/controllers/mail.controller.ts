import { Request, Response } from 'express';
import { z } from 'zod';
import { mailService } from '../services/mail.service';
import { parse } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { isEmailAddress, parseRecipients } from '../utils/mail';

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

/** Получатели строкой «a@b.by, c@d.by» — в список адресов с проверкой формата */
const recipients = (label: string, max: number) => z.string().max(5000).optional()
  .transform(v => parseRecipients(v))
  .refine(list => list.length <= max, `${label}: не больше ${max} адресов`)
  .refine(list => list.every(isEmailAddress), `${label}: некорректный адрес`);

/** Письмо из CRM: поля формы multipart (файлы — req.files, см. routes/mail.routes.ts) */
const sendBody = z.object({
  account: z.string().trim().min(1, 'Выберите ящик').max(300),
  to: recipients('Кому', 20).refine(list => list.length > 0, 'Укажите получателя'),
  cc: recipients('Копия', 20),
  subject: z.string().trim().max(500).default(''),
  text: z.string().max(100_000).default(''),
  replyToId: z.string().trim().max(50).optional(),
});
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

  async send(req: Request, res: Response) {
    const data = parse(sendBody, req.body ?? {});
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!data.text.trim() && !files.length) throw new AppError('Письмо пустое: напишите текст или приложите файл', 400);
    res.json({ data: await mailService.send({
      account: data.account,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      text: data.text,
      replyToId: data.replyToId || undefined,
      attachments: files.map(f => ({
        filename: f.originalname.slice(0, 300) || 'файл',
        content: f.buffer,
        contentType: f.mimetype || 'application/octet-stream',
      })),
    }) });
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
