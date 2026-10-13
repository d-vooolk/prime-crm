import { Request, Response } from 'express';
import { z } from 'zod';
import { siteLeadsService } from '../services/siteLeads.service';
import { SITE_LEAD_MAX_PHOTOS, SITE_LEAD_MAX_PHOTO_BYTES } from '../services/siteLeads.logic';
import { parse, requiredText, optionalText, id } from '../middleware/validate';

// Base64 длиннее файла на треть; лишние фото не отклоняют заявку, а отбрасываются
const receiveSchema = z.object({
  name: requiredText(200, 'Нет имени'),
  phone: requiredText(50, 'Нет телефона'),
  message: optionalText(5000),
  page: optionalText(500),
  source: optionalText(500),
  photos: z.array(z.string().max(Math.ceil(SITE_LEAD_MAX_PHOTO_BYTES * 1.4))).max(10).default([])
    .transform(list => list.slice(0, SITE_LEAD_MAX_PHOTOS)),
});

const listSchema = z.object({ status: z.enum(['new', 'handled']).default('new') });
const doneSchema = z.object({ done: z.boolean() });
const recordSchema = z.object({ recordId: id });

export const siteLeadsController = {
  /** Сайт присылает заявку из формы (вход по ключу, а не по токену пользователя) */
  async receive(req: Request, res: Response) {
    res.status(201).json({ data: await siteLeadsService.receive(parse(receiveSchema, req.body)) });
  },

  async list(req: Request, res: Response) {
    const { status } = parse(listSchema, req.query);
    res.json({ data: await siteLeadsService.list(status) });
  },

  async newCount(_req: Request, res: Response) {
    res.json({ data: { count: await siteLeadsService.newCount() } });
  },

  async setDone(req: Request, res: Response) {
    const { done } = parse(doneSchema, req.body);
    res.json({ data: await siteLeadsService.setDone(parse(id, req.params.id), done, req.user!) });
  },

  async attachRecord(req: Request, res: Response) {
    const { recordId } = parse(recordSchema, req.body);
    res.json({ data: await siteLeadsService.attachRecord(parse(id, req.params.id), recordId, req.user!) });
  },
};
