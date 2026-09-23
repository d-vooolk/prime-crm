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

export function ensureUploadDirs() {
  fs.mkdirSync(WIKI_MEDIA_DIR, { recursive: true });
}

/** Браузеры шлют имя файла в UTF-8, а busboy читает его как latin1 — возвращаем кириллицу. */
export function decodeOriginalName(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

// Некоторые телефоны и Windows присылают файл без MIME-типа (application/octet-stream) —
// тогда определяем вид по расширению. HEIC/HEIF браузеры на ПК не показывают, но хранить их можно.
const PHOTO_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'];
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.3gp'];

export const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/3gpp': '.3gp',
};

export function extOf(file: Express.Multer.File) {
  return path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
}

export function mediaKind(file: Express.Multer.File): 'photo' | 'video' | null {
  if (file.mimetype.startsWith('image/')) return 'photo';
  if (file.mimetype.startsWith('video/')) return 'video';
  const ext = extOf(file);
  if (PHOTO_EXT.includes(ext)) return 'photo';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}
