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
/**
 * Сколько приложение после показа ждёт ссылку в кеше: на iPhone окно разворачивается раньше,
 * чем просыпается service worker, и ссылка появляется через секунду-другую
 */
export const PENDING_NAV_WAIT_MS = 10 * 1000;
export const PENDING_NAV_POLL_MS = 400;

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

/**
 * iPhone: установленное приложение свёрнуто в фон — нажатие на пуш лишь разворачивает его,
 * service worker не получает notificationclick (WebKit bug 282935), а записанное им в хранилище
 * при приходе пуша приложению не видно. Поэтому после возврата приложение спрашивает сервер,
 * что ему пришло, пока оно было свёрнуто (GET /api/push/recent): пришло только что — значит,
 * вернулись по уведомлению, переходим сразу; давно — предлагаем плашкой «Открыть».
 */
export const AUTO_OPEN_MAX_AGE_MS = 2 * 60 * 1000;

export interface RecentPush {
  id: string;
  url: string;
  title: string;
  body: string;
  /** Сколько мс назад сервер отправил пуш */
  ageMs: number;
}

export function resumeAction(push: RecentPush | null, handled: ReadonlySet<string>): 'go' | 'offer' | null {
  if (!push || !isAppUrl(push.url) || handled.has(push.id)) return null;
  return push.ageMs <= AUTO_OPEN_MAX_AGE_MS ? 'go' : 'offer';
}

/** Журнал событий уведомлений для диагностики (Настройки → это устройство → «Журнал») */
export const NAV_LOG_MAX = 80;

export function parseLog(log: unknown): string[] {
  return Array.isArray(log) ? log.filter((l): l is string => typeof l === 'string') : [];
}

export function appendLog(log: unknown, line: string): string[] {
  return [...parseLog(log), line].slice(-NAV_LOG_MAX);
}

export function logLine(event: string, details: unknown, at: number): string {
  const time = new Date(at).toISOString().slice(11, 23);
  return `${time} ${event}${details === undefined ? '' : ` ${JSON.stringify(details)}`}`;
}
