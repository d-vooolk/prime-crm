import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AuthPayload } from '../middleware/auth.middleware';
import { RECORD_MEDIA_DIR, SITE_LEAD_MEDIA_DIR, SITE_LEAD_MEDIA_URL } from '../utils/uploads';
import { ROLES } from '../utils/roles';
import { logger } from '../utils/logger';
import { pushService, pushInBackground } from './push.service';
import { recordMediaService } from './recordMedia.service';
import { decodePhotoDataUrl, SITE_LEAD_MAX_PHOTOS } from './siteLeads.logic';

type LeadRow = Awaited<ReturnType<typeof prisma.siteLead.findMany>>[number];

const randomName = (prefix: string, ext: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

const withUrls = (lead: LeadRow) => ({
  ...lead,
  photoUrls: lead.photos.map(f => `${SITE_LEAD_MEDIA_URL}/${f}`),
});

/** Фото, которые не удалось разобрать, пропускаем: заявка важнее картинки */
async function savePhotos(dataUrls: string[]) {
  const saved: string[] = [];
  for (const dataUrl of dataUrls.slice(0, SITE_LEAD_MAX_PHOTOS)) {
    const photo = decodePhotoDataUrl(dataUrl);
    if (!photo) {
      logger.warn('Заявка с сайта: фото пропущено — не картинка или слишком большое');
      continue;
    }
    const filename = randomName('lead', photo.ext);
    await fs.promises.writeFile(path.join(SITE_LEAD_MEDIA_DIR, filename), photo.buffer);
    saved.push(filename);
  }
  return saved;
}

/** Заявки с сайта prime-auto.by: приём по ключу, список для менеджеров, «Выполнено» и «Записать» */
export const siteLeadsService = {
  async receive(data: { name: string; phone: string; message?: string; page?: string; source?: string; photos: string[] }) {
    const photos = await savePhotos(data.photos);
    const lead = await prisma.siteLead.create({
      data: {
        name: data.name,
        phone: data.phone,
        message: data.message ?? null,
        page: data.page ?? null,
        source: data.source ?? null,
        photos,
      },
    });
    const text = data.message ? ` — ${data.message.slice(0, 120)}` : '';
    pushInBackground(() => pushService.sendToRole(ROLES.MANAGER, {
      title: 'Заявка с сайта',
      body: `${data.name}, ${data.phone}${text}`,
      url: '/leads',
      tag: `site-lead-${lead.id}`,
    }));
    return { id: lead.id };
  },

  /** Новые — все, обработанные — последние 100 */
  async list(status: 'new' | 'handled') {
    const leads = await prisma.siteLead.findMany({
      where: status === 'new' ? { status: 'NEW' } : { status: { not: 'NEW' } },
      orderBy: status === 'new' ? { createdAt: 'desc' } : { handledAt: 'desc' },
      take: status === 'new' ? undefined : 100,
    });
    return leads.map(withUrls);
  },

  async newCount() {
    return prisma.siteLead.count({ where: { status: 'NEW' } });
  },

  /** Галочка «Выполнено»: снять можно, пока по заявке не создана запись */
  async setDone(id: string, done: boolean, user: AuthPayload) {
    const lead = await prisma.siteLead.findUnique({ where: { id } });
    if (!lead) throw new AppError('Заявка не найдена', 404);
    if (lead.status === 'RECORDED') throw new AppError('По заявке уже создана запись', 400);
    const updated = await prisma.siteLead.update({
      where: { id },
      data: done
        ? { status: 'DONE', handledAt: new Date(), handledByName: user.name }
        : { status: 'NEW', handledAt: null, handledByName: null },
    });
    return withUrls(updated);
  },

  /**
   * «Записать»: запись уже создана из окна с предзаполненным клиентом — привязываем её
   * к заявке, а фото заявки копируем в «Фото и видео» записи (сжимаются как обычные)
   */
  async attachRecord(id: string, recordId: string, user: AuthPayload) {
    const [lead, record] = await Promise.all([
      prisma.siteLead.findUnique({ where: { id } }),
      prisma.record.findUnique({ where: { id: recordId }, select: { id: true } }),
    ]);
    if (!lead) throw new AppError('Заявка не найдена', 404);
    if (!record) throw new AppError('Запись не найдена', 404);
    // Повторный запрос (сеть моргнула) не должен второй раз копировать фото
    if (lead.status === 'RECORDED' && lead.recordId === recordId) return withUrls(lead);

    const updated = await prisma.siteLead.update({
      where: { id },
      data: { status: 'RECORDED', recordId, handledAt: new Date(), handledByName: user.name },
    });

    for (const [i, photo] of lead.photos.entries()) {
      // Копия, а не перенос: у заявки и записи свои файлы и свой срок хранения
      const ext = path.extname(photo);
      const filename = randomName('photo', ext);
      try {
        await fs.promises.copyFile(path.join(SITE_LEAD_MEDIA_DIR, photo), path.join(RECORD_MEDIA_DIR, filename));
        const { size } = await fs.promises.stat(path.join(RECORD_MEDIA_DIR, filename));
        await recordMediaService.add(recordId, { filename, kind: 'photo', size, originalName: `site-photo-${i + 1}${ext}` }, user);
      } catch (err) {
        logger.warn('Заявка с сайта: фото не перенеслось в запись', { id, recordId, err });
      }
    }
    return withUrls(updated);
  },
};
