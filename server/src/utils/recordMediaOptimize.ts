import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { RECORD_MEDIA_DIR } from './uploads';
import { logger } from './logger';

/**
 * Сжатие фото и видео из карточки записи. С телефонов приходят фото по 3–10 МБ и видео
 * 1080p на 20 Мбит/с (≈170 МБ за минуту) — в карточке это открывалось минутами.
 *
 *  - фото: поворот по EXIF, длинная сторона до 2560 px, JPEG 82 (на глаз без потерь),
 *    HEIC с iPhone — в JPEG; превью для сетки — WebP 480 px;
 *  - видео: H.264 + AAC в MP4 (играет в любом браузере, в т.ч. iPhone), длинная сторона до 1920,
 *    CRF 26 и потолок 6 Мбит/с, индекс в начале файла (+faststart) — воспроизведение
 *    начинается сразу, без скачивания целиком; обложка — кадр JPEG 480 px.
 *
 * Сжатая копия заменяет оригинал, только если она меньше. Ошибка сжатия — не ошибка загрузки:
 * файл остаётся как есть.
 */

const PHOTO_MAX = 2560;
const THUMB_SIZE = 480;
const VIDEO_MAX = 1920;

export interface OptimizedMedia {
  filename: string;
  size: number;
  thumbFilename: string | null;
}

const fullPath = (filename: string) => path.join(RECORD_MEDIA_DIR, filename);
const newName = (prefix: string, ext: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

export const removeMediaFile = (filename: string | null | undefined) =>
  filename ? fs.promises.unlink(fullPath(filename)).catch(() => undefined) : Promise.resolve();

const isHeic = (filename: string) => ['.heic', '.heif'].includes(path.extname(filename).toLowerCase());

// ─── Фото ───────────────────────────────────────────

export async function optimizePhoto(filename: string): Promise<OptimizedMedia> {
  const source = fullPath(filename);
  const originalSize = (await fs.promises.stat(source)).size;
  const input = isHeic(filename)
    ? Buffer.from(await heicConvert({ buffer: await fs.promises.readFile(source), format: 'JPEG', quality: 0.92 }))
    : source;
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const animated = meta.format === 'gif' && (meta.pages ?? 1) > 1;

  const thumbFilename = newName('thumb', '.webp');
  await sharp(input, { failOn: 'none', animated: false })
    .rotate()
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'outside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(fullPath(thumbFilename));

  // Анимацию не трогаем — в JPEG она стала бы картинкой
  if (animated) return { filename, size: originalSize, thumbFilename };

  const compressed = newName('photo', '.jpg');
  await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: PHOTO_MAX, height: PHOTO_MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(fullPath(compressed));
  const size = (await fs.promises.stat(fullPath(compressed))).size;

  // HEIC браузеры не показывают — JPEG нужен в любом случае; остальное — только если стало меньше
  if (isHeic(filename) || size < originalSize) {
    await removeMediaFile(filename);
    return { filename: compressed, size, thumbFilename };
  }
  await removeMediaFile(compressed);
  return { filename, size: originalSize, thumbFilename };
}

// ─── Видео ──────────────────────────────────────────

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} завершился с кодом ${code}: ${stderr}`))));
  });
}

/** Длинная сторона не больше VIDEO_MAX, стороны чётные (требование H.264) */
const SCALE = `scale=w='if(gte(iw,ih),min(${VIDEO_MAX},iw),-2)':h='if(gte(iw,ih),-2,min(${VIDEO_MAX},ih))'`;

export async function optimizeVideo(filename: string): Promise<OptimizedMedia> {
  const originalSize = (await fs.promises.stat(fullPath(filename))).size;
  const compressed = newName('video', '.mp4');
  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', fullPath(filename),
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', SCALE,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-maxrate', '6M', '-bufsize', '12M',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      // Сервер небольшой и общий с другими проектами — не больше двух потоков
      '-threads', '2',
      fullPath(compressed),
    ]);
  } catch (err) {
    await removeMediaFile(compressed);
    throw err;
  }

  const size = (await fs.promises.stat(fullPath(compressed))).size;
  // Перекодированное оставляем, даже если не меньше: оригинал мог быть HEVC/MOV, который не играет в браузере
  const keepCompressed = size < originalSize || path.extname(filename).toLowerCase() !== '.mp4';
  const result = keepCompressed ? compressed : filename;
  if (keepCompressed) await removeMediaFile(filename);
  else await removeMediaFile(compressed);

  let thumbFilename: string | null = newName('thumb', '.jpg');
  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', '0.5', '-i', fullPath(result),
      '-frames:v', '1', '-vf', `scale=${THUMB_SIZE}:-2`, '-q:v', '4',
      fullPath(thumbFilename),
    ]);
    // Видео короче полсекунды — кадра на этой отметке нет, файл не создаётся
    await fs.promises.access(fullPath(thumbFilename));
  } catch {
    await removeMediaFile(thumbFilename);
    thumbFilename = null;
  }

  return { filename: result, size: keepCompressed ? size : originalSize, thumbFilename };
}

// ─── Очереди ───────────────────────────────────────

/**
 * Файлы сжимаются по одному: фото — в своей очереди (это доли секунды, загрузка ждёт результата),
 * видео — в своей, в фоне (минуты), чтобы перекодирование не задерживало загрузку фото.
 */
function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const runTask = tail.then(task, task);
    tail = runTask.catch(err => logger.warn('Сжатие фото/видео записи не удалось', { err }));
    return runTask;
  };
}

export const photoQueue = serialQueue();
export const videoQueue = serialQueue();
