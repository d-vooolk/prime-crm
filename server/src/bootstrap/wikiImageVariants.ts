import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { WIKI_MEDIA_DIR } from '../utils/uploads';
import { VARIANTS_VERSION, createImageVariants, removeVariants } from '../utils/wikiImages';

/**
 * Догенерация сжатых вариантов для фото, загруженных до появления сжатия (и перенесённых
 * из старой вики), а также после смены VARIANTS_VERSION.
 *
 * Запускается при старте в фоне, старт сервера не ждёт. Фото обрабатываются строго по одному
 * (общая очередь с загрузками, см. utils/wikiImages.ts). Идемпотентно: обработанные фото
 * помечаются variantsVersion и при следующем старте пропускаются.
 */

const BATCH_SIZE = 50;

function log(msg: string) {
  console.log(`[wiki-variants] ${msg}`); // eslint-disable-line no-console
}

export async function generateMissingWikiVariants() {
  let processed = 0;
  let failed = 0;
  // Id, которые не удалось сохранить (например, фото удалили во время обработки), — чтобы не зациклиться
  const skip: string[] = [];

  try {
    for (;;) {
      const batch = await prisma.wikiMedia.findMany({
        where: { type: 'PHOTO', variantsVersion: { lt: VARIANTS_VERSION }, id: { notIn: skip } },
        orderBy: { createdAt: 'desc' }, // сначала свежие — их открывают чаще
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;

      for (const media of batch) {
        const oldFiles = [media.thumbFilename, media.mediumFilename, media.displayFilename].filter((f): f is string => !!f);
        const variants = await createImageVariants(media.filename);
        try {
          await prisma.wikiMedia.update({ where: { id: media.id }, data: variants });
          processed++;
          if (!variants.thumbFilename) failed++;
          // Файлы прошлой версии сжатия больше не нужны
          const fresh = [variants.thumbFilename, variants.mediumFilename, variants.displayFilename];
          for (const f of oldFiles) {
            if (!fresh.includes(f)) fs.promises.unlink(path.join(WIKI_MEDIA_DIR, f)).catch(() => {});
          }
        } catch {
          // Фото удалили, пока его сжимали, — варианты тоже не нужны
          skip.push(media.id);
          const stillExists = await prisma.wikiMedia.count({ where: { filename: media.filename } });
          if (!stillExists) await removeVariants(media.filename);
        }
      }
    }
  } catch (e) {
    log(`ошибка: ${(e as Error).message}`);
  }

  if (processed) log(`обработано фото: ${processed}${failed ? `, без вариантов (битые): ${failed}` : ''}`);
}
