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
 * iPhone: приложение висит в фоне — нажатие на пуш лишь разворачивает его, service worker
 * не получает ни notificationclick, ни notificationclose (WebKit bug 282935, открыт с iOS 17).
 * Поэтому service worker запоминает показанные уведомления, а приложение после возврата
 * спрашивает, какое из них исчезло: исчезло ровно одно — его и нажали.
 */
export const SHOWN_NOTIFICATIONS_KEY = '/__shown-notifications';
/** Приложение → service worker: какое уведомление нажали, пока приложение было в фоне (ответ — через MessagePort) */
export const TAPPED_QUERY_MESSAGE = 'TAPPED_NOTIFICATION';
/** Приложение → service worker при уходе в фон: забыть уведомления, убранные, пока приложение было открыто */
export const NOTIFICATIONS_SYNC_MESSAGE = 'NOTIFICATIONS_SYNC';
/** Сообщение NOTIFICATIONS_SYNC, дошедшее позже этого (окно успело замереть), не выполняется */
export const SYNC_MAX_DELAY_MS = 1500;

export function isFreshSync(at: unknown, now: number): boolean {
  return typeof at === 'number' && now - at >= -SYNC_MAX_DELAY_MS && now - at <= SYNC_MAX_DELAY_MS;
}

/** Уведомление старше этого не считается: его давно смахнули или открыли без нас */
export const SHOWN_TTL_MS = 24 * 60 * 60 * 1000;
const SHOWN_MAX = 50;
/** Когда проверять после возврата (мс): iOS убирает нажатое уведомление не мгновенно */
export const TAPPED_CHECK_DELAYS_MS = [0, 700, 2000];

export interface ShownNotification {
  id: string;
  url: string;
  tag?: string;
  at: number;
}

function isShown(value: unknown): value is ShownNotification {
  if (!value || typeof value !== 'object') return false;
  const { id, url, tag, at } = value as Partial<ShownNotification>;
  return typeof id === 'string' && isAppUrl(url) && typeof at === 'number'
    && (tag === undefined || typeof tag === 'string');
}

/** Разбор сохранённого списка: битое и устаревшее отбрасывается */
export function parseShown(raw: unknown, now: number): ShownNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isShown).filter(n => now - n.at <= SHOWN_TTL_MS && n.at <= now + SHOWN_TTL_MS);
}

/** Новое уведомление: с тем же tag оно заменяет прежнее на экране — прежнее из списка убираем */
export function addShown(list: ShownNotification[], entry: ShownNotification, now: number): ShownNotification[] {
  const rest = parseShown(list, now).filter(n => n.id !== entry.id && !(entry.tag && n.tag === entry.tag));
  return [...rest, entry].slice(-SHOWN_MAX);
}

/** Какие из запомненных уведомлений больше не на экране */
export function splitVanished(list: ShownNotification[], displayedIds: ReadonlySet<string>, now: number) {
  const fresh = parseShown(list, now);
  return {
    kept: fresh.filter(n => displayedIds.has(n.id)),
    vanished: fresh.filter(n => !displayedIds.has(n.id)),
  };
}

/** Исчезло ровно одно — его нажали. Несколько — «Очистить всё», переходить некуда */
export function pickTapped(vanished: ShownNotification[]): ShownNotification | null {
  return vanished.length === 1 ? vanished[0] : null;
}
