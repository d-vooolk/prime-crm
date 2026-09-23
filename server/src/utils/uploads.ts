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
