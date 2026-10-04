import fs from 'fs';
import path from 'path';

/**
 * Каталог загружаемых файлов. В проде это смонтированная папка хоста (см. docker-compose.yml),
 * иначе файлы пропадали бы при каждой пересборке контейнера.
 * Раздаётся статикой по /api/uploads/*.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '..', '..', 'uploads');

export const WIKI_MEDIA_DIR = path.join(UPLOADS_DIR, 'wiki');
export const WIKI_MEDIA_URL = '/api/uploads/wiki';

export const RECORD_MEDIA_DIR = path.join(UPLOADS_DIR, 'records');
export const RECORD_MEDIA_URL = '/api/uploads/records';

export function ensureUploadDirs() {
  fs.mkdirSync(WIKI_MEDIA_DIR, { recursive: true });
  fs.mkdirSync(RECORD_MEDIA_DIR, { recursive: true });
}

/** Браузеры шлют имя файла в UTF-8, а busboy читает его как latin1 — возвращаем кириллицу. */
export function decodeOriginalName(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

// Разрешённые форматы. Тип файла определяется по содержимому (сигнатуре), а не по тому, что
// прислал браузер: раньше под видом фото можно было загрузить HTML со скриптом.
const PHOTO_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'];
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.3gp'];

export type MediaKind = 'photo' | 'video';

export function extOf(file: { originalname: string }) {
  return path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
}

/** Предварительная проверка до загрузки: по MIME-типу или расширению похоже на фото/видео. */
export function mediaKind(file: { mimetype: string; originalname: string }): MediaKind | null {
  const ext = extOf(file);
  if (PHOTO_EXT.includes(ext)) return 'photo';
  if (VIDEO_EXT.includes(ext)) return 'video';
  // Некоторые телефоны и Windows присылают файл без расширения — тогда по MIME-типу
  if (!ext && file.mimetype.startsWith('image/')) return 'photo';
  if (!ext && file.mimetype.startsWith('video/')) return 'video';
  return null;
}

// Бренды контейнера ISO BMFF (байты 8–11 после «ftyp»): HEIC/HEIF — фото, остальное — видео
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif'];

/**
 * Настоящий формат по первым байтам файла. Возвращает вид и расширение, с которым файл
 * будет сохранён (расширение из имени файла пользователя не используется).
 */
export function sniffMedia(head: Buffer): { kind: MediaKind; ext: string } | null {
  const ascii = (from: number, to: number) => head.subarray(from, to).toString('latin1');
  if (head.length < 12) return null;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: 'photo', ext: '.jpg' };
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'photo', ext: '.png' };
  if (ascii(0, 4) === 'GIF8') return { kind: 'photo', ext: '.gif' };
  if (ascii(0, 2) === 'BM') return { kind: 'photo', ext: '.bmp' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { kind: 'photo', ext: '.webp' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'AVI ') return { kind: 'video', ext: '.avi' };
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return { kind: 'video', ext: head.includes(Buffer.from('webm')) ? '.webm' : '.mkv' };
  }
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12).toLowerCase();
    if (HEIF_BRANDS.includes(brand)) return { kind: 'photo', ext: brand === 'avif' ? '.avif' : '.heic' };
    if (brand === 'qt  ') return { kind: 'video', ext: '.mov' };
    if (brand.startsWith('3g')) return { kind: 'video', ext: '.3gp' };
    return { kind: 'video', ext: '.mp4' };
  }
  return null;
}

/** Читает начало сохранённого файла и определяет формат */
export async function sniffMediaFile(filePath: string) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const head = Buffer.alloc(64);
    const { bytesRead } = await handle.read(head, 0, 64, 0);
    return sniffMedia(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}
