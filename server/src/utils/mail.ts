/** Чистые функции почты (services/mail.service.ts) — вынесены для тестов */

/** Начало текста письма для списка: без лишних пробелов и цитат, до 160 символов */
export function makePreview(text: string | null | undefined, max = 160): string | null {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('>'));
  const flat = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Типы вложений, которые браузер может открыть сам и которые не выполнят скрипт в нашем домене.
 * Остальное (HTML, SVG, офисные файлы …) отдаём как application/octet-stream — только скачивание.
 */
const VIEWABLE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

export function safeContentType(contentType: string | null | undefined): string {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  return VIEWABLE_TYPES.includes(type) ? type : 'application/octet-stream';
}

export const isViewableType = (contentType: string) => VIEWABLE_TYPES.includes(safeContentType(contentType));

/** Обрезать строку до длины столбца (заголовки писем бывают огромными) */
export const clip = (value: string | null | undefined, max: number): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/**
 * Какие UID забирать. Диапазон «N:*» по IMAP всегда возвращает хотя бы последнее письмо,
 * даже если его UID меньше N, — поэтому фильтруем уже забранные. Порядок — по возрастанию,
 * чтобы lastUid двигался без пропусков.
 */
export function pickNewUids(uids: number[], lastUid: number, limit: number): number[] {
  const fresh = [...new Set(uids.filter(u => u > lastUid))].sort((a, b) => a - b);
  // Слишком много новых (первый запуск, сменилась папка) — берём самые свежие
  return fresh.length > limit ? fresh.slice(fresh.length - limit) : fresh;
}
