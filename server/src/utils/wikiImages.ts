import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { WIKI_MEDIA_DIR, WIKI_MEDIA_URL } from './uploads';

/**
 * Сжатые варианты фото вики: оригиналы с телефонов весят по 3–10 МБ, и сетка из десятков
 * таких файлов грузится долго и тормозит прокрутку.
 *
 * - placeholder — ~32px, размытое, хранится прямо в БД (data URL), показывается мгновенно;
 * - thumb — короткая сторона ~400px, для сетки;
 * - medium — длинная сторона ~1280px, для просмотра;
 * - оригинал не трогаем, его можно открыть отдельно;
 * - HEIC/HEIF (фото с iPhone) libvips без HEVC-декодера не читает, а браузеры на ПК не показывают:
 *   сначала перекодируем в полноразмерный JPEG (displayFilename) — он заменяет оригинал в просмотре,
 *   и уже из него делаем остальные варианты.
 *
 * Файлы лежат в UPLOADS_DIR/wiki/variants/<имя оригинала без расширения>/ — при удалении
 * медиа удаляется вся папка. В имени файла есть версия: статика отдаёт их как immutable,
 * поэтому при смене параметров сжатия (VARIANTS_VERSION) имена тоже должны поменяться.
 */

/** Увеличить, если поменялись размеры/качество — при старте сервера варианты пересоздадутся. */
export const VARIANTS_VERSION = 1;

const VARIANTS_SUBDIR = 'variants';
const THUMB_SIZE = 400;
const MEDIUM_SIZE = 1280;
const PLACEHOLDER_SIZE = 32;

// Сервер небольшой: картинки жмём по одной и без кеша libvips, чтобы не съесть память
sharp.cache(false);
sharp.concurrency(1);

export interface ImageVariants {
  width: number | null;
  height: number | null;
  placeholder: string | null;
  thumbFilename: string | null;
  mediumFilename: string | null;
  /** Полноразмерная копия, которую может показать браузер (JPEG из HEIC). Для остальных — null */
  displayFilename: string | null;
  variantsVersion: number;
}

/** Нет вариантов — фронт показывает оригинал. Версию всё равно ставим, чтобы не пытаться снова. */
const NO_VARIANTS: ImageVariants = {
  width: null,
  height: null,
  placeholder: null,
  thumbFilename: null,
  mediumFilename: null,
  displayFilename: null,
  variantsVersion: VARIANTS_VERSION,
};

const HEIC_EXT = ['.heic', '.heif'];

export const isHeic = (filename: string) => HEIC_EXT.includes(path.extname(filename).toLowerCase());

/** HEIC → JPEG в папку вариантов. Возвращает относительное имя файла или null, если не вышло. */
async function convertHeic(filename: string): Promise<string | null> {
  const dirName = variantsDirName(filename);
  const fullName = `v${VARIANTS_VERSION}-full.jpg`;
  try {
    const buffer = await fs.promises.readFile(path.join(WIKI_MEDIA_DIR, filename));
    const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 });
    await fs.promises.mkdir(variantsDir(filename), { recursive: true });
    await fs.promises.writeFile(path.join(variantsDir(filename), fullName), Buffer.from(jpeg));
    return `${VARIANTS_SUBDIR}/${dirName}/${fullName}`;
  } catch {
    return null;
  }
}

function variantsDirName(filename: string) {
  return path.parse(filename).name;
}

export function variantsDir(filename: string) {
  return path.join(WIKI_MEDIA_DIR, VARIANTS_SUBDIR, variantsDirName(filename));
}

export function variantUrl(relative: string | null) {
  return relative ? `${WIKI_MEDIA_URL}/${relative}` : null;
}

/** Удаляет все варианты оригинала (любых версий). */
export function removeVariants(filename: string) {
  if (!variantsDirName(filename)) return Promise.resolve();
  return fs.promises.rm(variantsDir(filename), { recursive: true, force: true }).catch(() => {});
}

async function buildVariants(filename: string): Promise<ImageVariants> {
  if (!fs.existsSync(path.join(WIKI_MEDIA_DIR, filename))) return NO_VARIANTS;

  // HEIC сжимаем из перекодированного JPEG
  const displayFilename = isHeic(filename) ? await convertHeic(filename) : null;
  if (isHeic(filename) && !displayFilename) return NO_VARIANTS;
  const source = path.join(WIKI_MEDIA_DIR, displayFilename ?? filename);

  // failOn: 'none' — недокачанные с телефона JPEG всё равно показываем, насколько получится.
  // animated: false — у GIF берём первый кадр (для просмотра остаётся оригинал).
  const input = () => sharp(source, { failOn: 'none', animated: false }).rotate();

  let meta: sharp.Metadata;
  try {
    meta = await sharp(source, { failOn: 'none' }).metadata();
  } catch {
    // HEIC и прочее, что libvips не декодирует
    return NO_VARIANTS;
  }
  if (!meta.width || !meta.height) return NO_VARIANTS;

  // Ориентация 5–8 из EXIF — кадр повёрнут на 90°, после rotate() стороны меняются местами
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  const dirName = variantsDirName(filename);
  const dir = variantsDir(filename);
  const thumbName = `v${VARIANTS_VERSION}-thumb.webp`;
  const mediumName = `v${VARIANTS_VERSION}-medium.webp`;

  try {
    await fs.promises.mkdir(dir, { recursive: true });

    await input()
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'outside', withoutEnlargement: true })
      .webp({ quality: 70, effort: 4 })
      .toFile(path.join(dir, thumbName));

    // Анимированный GIF в medium превратился бы в статичную картинку — смотрим оригинал
    const withMedium = meta.format !== 'gif';
    if (withMedium) {
      await input()
        .resize({ width: MEDIUM_SIZE, height: MEDIUM_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(path.join(dir, mediumName));
    }

    const tiny = await input()
      .resize({ width: PLACEHOLDER_SIZE, height: PLACEHOLDER_SIZE, fit: 'inside' })
      .blur(1)
      .webp({ quality: 40 })
      .toBuffer();

    return {
      width,
      height,
      placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
      thumbFilename: `${VARIANTS_SUBDIR}/${dirName}/${thumbName}`,
      mediumFilename: withMedium ? `${VARIANTS_SUBDIR}/${dirName}/${mediumName}` : null,
      displayFilename,
      variantsVersion: VARIANTS_VERSION,
    };
  } catch {
    // JPEG из HEIC оставляем — его хотя бы можно посмотреть
    if (!displayFilename) await removeVariants(filename);
    return { ...NO_VARIANTS, width, height, displayFilename };
  }
}

/**
 * Очередь сжатия на весь процесс: при загрузке пачки фото запросы приходят параллельно,
 * а фоновая догенерация для старых фото идёт одновременно с ними.
 */
let queue: Promise<unknown> = Promise.resolve();

export function createImageVariants(filename: string): Promise<ImageVariants> {
  const run = queue.then(() => buildVariants(filename));
  queue = run.catch(() => {});
  return run.catch(() => NO_VARIANTS);
}
