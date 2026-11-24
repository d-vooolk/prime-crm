import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { parse, id } from '../middleware/validate';
import { wikiService, WikiKey } from '../services/wiki.service';
import { wikiProposalsService, VdfAuthor } from '../services/wikiProposals.service';
import { decodeOriginalName, WIKI_MEDIA_DIR } from '../utils/uploads';
import type { UploadedMedia } from '../utils/mediaUpload';
import { createImageVariants } from '../utils/wikiImages';

/**
 * Вики для оптовиков vdf.by. Магазин сам проверяет, что покупатель — оптовик, и передаёт его
 * в заголовках x-vdf-customer-id / -name (encodeURIComponent) / -phone. Ключ — общий VDF_INTEGRATION_KEY.
 */

const authorSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(30).optional(),
});

function authorOf(req: Request): VdfAuthor {
  const decode = (v: string | undefined) => {
    try { return v ? decodeURIComponent(v) : undefined; } catch { return undefined; }
  };
  return parse(authorSchema, {
    customerId: req.get('x-vdf-customer-id'),
    name: decode(req.get('x-vdf-customer-name')),
    phone: decode(req.get('x-vdf-customer-phone')) || undefined,
  });
}

const keySchema = z.object({
  markId: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(100),
  generationId: z.string().trim().min(1).max(100),
});

/** Раздел карточки: пусто — «Общее» */
const sectionIdSchema = z.preprocess(v => (v === '' || v === undefined ? null : v), z.string().min(1).max(50).nullable());

const textSchema = keySchema.extend({
  sectionId: sectionIdSchema,
  text: z.string().max(20000, 'Текст слишком длинный'),
});

const productSchema = keySchema.extend({
  sectionId: sectionIdSchema,
  productId: z.string().trim().min(1).max(200),
});

const sectionFieldSchema = z.object({ sectionId: sectionIdSchema });

export const wikiVdfController = {
  async entries(_req: Request, res: Response) {
    res.json({ data: await wikiService.listEntries() });
  },

  async sections(_req: Request, res: Response) {
    const sections = await wikiService.listSections();
    res.json({ data: sections.map(({ id: sectionId, name, sortOrder }) => ({ id: sectionId, name, sortOrder })) });
  },

  async entry(req: Request, res: Response) {
    res.json({ data: await wikiProposalsService.entryFor(parse(keySchema, req.query), authorOf(req)) });
  },

  async proposals(req: Request, res: Response) {
    res.json({ data: await wikiProposalsService.listFor(authorOf(req)) });
  },

  async saveText(req: Request, res: Response) {
    const { sectionId, text, ...key } = parse(textSchema, req.body);
    res.json({ data: await wikiProposalsService.saveText(key, sectionId, text, authorOf(req)) });
  },

  async uploadMedia(req: Request, res: Response) {
    const upload = res.locals.media as UploadedMedia;
    let key: WikiKey;
    let sectionId: string | null;
    let author: VdfAuthor;
    try {
      key = parse(keySchema, req.body);
      sectionId = parse(sectionFieldSchema, req.body).sectionId;
      author = authorOf(req);
    } catch (e) {
      fs.promises.unlink(path.join(WIKI_MEDIA_DIR, upload.filename)).catch(() => {});
      throw e;
    }
    const type = upload.kind === 'video' ? 'VIDEO' : 'PHOTO';
    const variants = type === 'PHOTO' ? await createImageVariants(upload.filename) : undefined;
    const media = await wikiProposalsService.addMedia(key, sectionId, {
      filename: upload.filename,
      originalName: decodeOriginalName(upload.originalName),
      size: upload.size,
      type,
      variants,
    }, author);
    res.status(201).json({ data: media });
  },

  async removeMedia(req: Request, res: Response) {
    await wikiProposalsService.removeMedia(parse(id, req.params.id), authorOf(req));
    res.json({ data: { ok: true } });
  },

  async addProduct(req: Request, res: Response) {
    const { sectionId, productId, ...key } = parse(productSchema, req.body);
    res.json({ data: await wikiProposalsService.addProduct(key, sectionId, productId, authorOf(req)) });
  },

  async removeProduct(req: Request, res: Response) {
    await wikiProposalsService.removeProduct(parse(id, req.params.id), authorOf(req));
    res.json({ data: { ok: true } });
  },

  async submit(req: Request, res: Response) {
    res.json({ data: await wikiProposalsService.submit(parse(id, req.params.id), authorOf(req)) });
  },

  async discard(req: Request, res: Response) {
    await wikiProposalsService.discard(parse(id, req.params.id), authorOf(req));
    res.json({ data: { ok: true } });
  },
};
