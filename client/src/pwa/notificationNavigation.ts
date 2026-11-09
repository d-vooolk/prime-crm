/**
 * Переход по нажатию на пуш, когда приложение уже открыто (sw.ts ↔ hooks/useNotificationNavigation.ts).
 * Сообщение NAVIGATE от service worker на телефоне теряется, если окно в этот момент «заморожено»
 * в фоне, поэтому ссылка ещё и кладётся в отдельный кеш — приложение забирает её, когда снова видно.
 * Модуль общий для service worker и приложения: только константы и чистая логика, без DOM.
 */

/** Сообщение открытому окну: перейти по ссылке из уведомления */
export const NAVIGATE_MESSAGE = 'NAVIGATE';
export const PENDING_NAV_CACHE = 'prime-pending-nav';
export const PENDING_NAV_KEY = '/__pending-navigation';
/** Ссылка из кеша старше этого не используется — пуш нажали давно, приложение открыли само */
export const PENDING_NAV_TTL_MS = 60 * 1000;

export interface PendingNavigation {
  id: string;
  url: string;
  at: number;
}

/** Своя ссылка приложения (не на чужой сайт) */
export function isAppUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

/** Разбор сохранённой ссылки: устаревшая, уже выполненная или битая — null */
export function takePending(raw: unknown, now: number, handled: ReadonlySet<string>): PendingNavigation | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, url, at } = raw as Partial<PendingNavigation>;
  if (typeof id !== 'string' || typeof at !== 'number' || !isAppUrl(url)) return null;
  if (handled.has(id) || now - at > PENDING_NAV_TTL_MS || at > now + PENDING_NAV_TTL_MS) return null;
  return { id, url, at };
}
