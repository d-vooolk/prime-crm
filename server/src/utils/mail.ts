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

/** Адреса получателей из строки «a@b.by, Имя <c@d.by>; e@f.by»: только адреса, без повторов */
export function parseRecipients(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const raw = part.trim();
    if (!raw) continue;
    const address = (raw.match(/<([^<>]+)>\s*$/)?.[1] ?? raw).trim();
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(address);
  }
  return result;
}

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
export const isEmailAddress = (value: string) => EMAIL.test(value);

/** Тема ответа: «Re: тема» без повторных «Re:» */
export function replySubject(subject: string | null | undefined): string {
  const base = (subject ?? '').trim();
  if (!base) return 'Re:';
  return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
}

/** Цепочка References ответа: старая цепочка + Message-ID письма, на которое отвечаем */
export function replyReferences(messageId: string | null | undefined, references?: string | null): string | undefined {
  const ids = [...(references ?? '').split(/\s+/), messageId ?? ''].map(s => s.trim()).filter(Boolean);
  return ids.length ? [...new Set(ids)].join(' ') : undefined;
}

/** HTML письма из обычного текста: экранирование и переносы строк */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${escaped.replace(/\r?\n/g, '<br>')}</div>`;
}
