import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { REPAIR_TYPE_MEDIA_DIR, REPAIR_TYPE_MEDIA_URL } from '../utils/uploads';
import { isHeic } from '../utils/wikiImages';
import type { UploadedMedia } from '../utils/mediaUpload';
import { logger } from '../utils/logger';

export interface RepairTypeFaqItem { question: string; answer: string }
export interface RepairTypeLink { title: string; url: string }

export interface RepairTypeInput {
  name: string;
  description?: string;
  faq?: RepairTypeFaqItem[];
  links?: RepairTypeLink[];
  sortOrder?: number | null;
}

/** Фото показываются клиенту на телефоне — длинная сторона 1280px хватает с запасом */
const PHOTO_SIZE = 1280;
const MAX_PHOTOS = 12;

const removeQuietly = (filePath: string) => fs.promises.unlink(filePath).catch(() => undefined);

export const photoUrl = (filename: string) => `${REPAIR_TYPE_MEDIA_URL}/${filename}`;

const INCLUDE = {
  photos: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { services: { where: { isActive: true } } } },
};

type RepairTypeRow = Prisma.RepairTypeGetPayload<{ include: typeof INCLUDE }>;

/** faq и links в базе — JSON; наружу отдаём массивы нужной формы, даже если там мусор */
function toDto(row: RepairTypeRow) {
  const asArray = (v: Prisma.JsonValue) => (Array.isArray(v) ? v : []);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    faq: asArray(row.faq) as unknown as RepairTypeFaqItem[],
    links: asArray(row.links) as unknown as RepairTypeLink[],
    sortOrder: row.sortOrder,
    servicesCount: row._count.services,
    photos: row.photos.map(p => ({ id: p.id, url: photoUrl(p.filename) })),
  };
}

/**
 * Загруженное фото → WebP с длинной стороной до 1280px. Оригиналы с телефонов весят мегабайты,
 * а страницу записи клиент открывает по мобильному интернету. HEIC (iPhone) libvips не читает —
 * сначала перекодируем в JPEG.
 */
async function compressPhoto(srcPath: string): Promise<string> {
  const input = isHeic(srcPath)
    ? Buffer.from(await heicConvert({ buffer: await fs.promises.readFile(srcPath), format: 'JPEG', quality: 0.9 }))
    : srcPath;
  const filename = `rt-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  await sharp(input)
    .rotate() // поворот по EXIF, иначе фото с телефона ляжет боком
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(REPAIR_TYPE_MEDIA_DIR, filename));
  return filename;
}

export const repairTypesService = {
  async list() {
    const rows = await prisma.repairType.findMany({
      include: INCLUDE,
      orderBy: [{ sortOrder: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    });
    return rows.map(toDto);
  },

  async create(data: RepairTypeInput) {
    const row = await prisma.repairType.create({
      data: {
        name: data.name,
        description: data.description ?? '',
        faq: (data.faq ?? []) as unknown as Prisma.InputJsonValue,
        links: (data.links ?? []) as unknown as Prisma.InputJsonValue,
        sortOrder: data.sortOrder ?? null,
      },
      include: INCLUDE,
    });
    return toDto(row);
  },

  async update(id: string, data: Partial<RepairTypeInput>) {
    const row = await prisma.repairType.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        faq: data.faq as unknown as Prisma.InputJsonValue | undefined,
        links: data.links as unknown as Prisma.InputJsonValue | undefined,
        sortOrder: data.sortOrder,
      },
      include: INCLUDE,
    });
    return toDto(row);
  },

  /** У услуг тип снимается (ON DELETE SET NULL), фото удаляются с диска */
  async delete(id: string) {
    const photos = await prisma.repairTypePhoto.findMany({ where: { repairTypeId: id }, select: { filename: true } });
    await prisma.repairType.delete({ where: { id } });
    await Promise.all(photos.map(p => removeQuietly(path.join(REPAIR_TYPE_MEDIA_DIR, p.filename))));
  },

  async addPhoto(id: string, media: UploadedMedia) {
    const uploadedPath = path.join(REPAIR_TYPE_MEDIA_DIR, media.filename);
    try {
      if (media.kind !== 'photo') throw new AppError('Можно загрузить только фото', 400);
      const type = await prisma.repairType.findUnique({ where: { id }, include: { _count: { select: { photos: true } } } });
      if (!type) throw new AppError('Тип ремонта не найден', 404);
      if (type._count.photos >= MAX_PHOTOS) throw new AppError(`Не больше ${MAX_PHOTOS} фото`, 400);

      let filename: string;
      try {
        filename = await compressPhoto(uploadedPath);
      } catch (err) {
        logger.warn('Не удалось обработать фото типа ремонта', { err });
        throw new AppError('Не удалось обработать фото, попробуйте JPEG или PNG', 400);
      }
      const photo = await prisma.repairTypePhoto.create({
        data: { repairTypeId: id, filename, sortOrder: type._count.photos },
      });
      return { id: photo.id, url: photoUrl(photo.filename) };
    } finally {
      // Оригинал не нужен: на странице показывается сжатая копия
      await removeQuietly(uploadedPath);
    }
  },

  async deletePhoto(id: string, photoId: string) {
    const photo = await prisma.repairTypePhoto.findFirst({ where: { id: photoId, repairTypeId: id } });
    if (!photo) throw new AppError('Фото не найдено', 404);
    await prisma.repairTypePhoto.delete({ where: { id: photo.id } });
    await removeQuietly(path.join(REPAIR_TYPE_MEDIA_DIR, photo.filename));
  },
};
