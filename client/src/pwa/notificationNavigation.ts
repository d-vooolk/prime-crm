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
 * спрашивает его (TAPPED_QUERY_MESSAGE):
 *  - браузер отдаёт список уведомлений на экране (listed) и из него исчезло ровно одно —
 *    его и нажали, переходим сразу;
 *  - иначе пока приложение было в фоне пришли уведомления — показываем последнее
 *    плашкой с кнопкой «Открыть».
 */
export const SHOWN_NOTIFICATIONS_KEY = '/__shown-notifications';
/** Приложение → service worker: что нажали / что пришло, пока приложение было в фоне (ответ — через MessagePort) */
export const TAPPED_QUERY_MESSAGE = 'TAPPED_NOTIFICATION';
/** Приложение → service worker при уходе в фон: забыть уведомления, убранные, пока приложение было открыто */
export const NOTIFICATIONS_SYNC_MESSAGE = 'NOTIFICATIONS_SYNC';
/** Сообщение NOTIFICATIONS_SYNC, дошедшее позже этого (окно успело замереть), не выполняется */
export const SYNC_MAX_DELAY_MS = 1500;
/** Уведомление старше этого не считается: его давно смахнули или открыли без нас */
export const SHOWN_TTL_MS = 24 * 60 * 60 * 1000;
const SHOWN_MAX = 50;
/** Когда проверять после возврата (мс): iOS убирает нажатое уведомление не мгновенно */
export const TAPPED_CHECK_DELAYS_MS = [0, 700, 2000];

export function isFreshSync(at: unknown, now: number): boolean {
  return typeof at === 'number' && now - at >= -SYNC_MAX_DELAY_MS && now - at <= SYNC_MAX_DELAY_MS;
}

export interface ShownNotification {
  id: string;
  url: string;
  at: number;
  tag?: string;
  title?: string;
  body?: string;
  /** Браузер отдал его в getNotifications() — значит, по исчезновению можно понять нажатие */
  listed?: boolean;
}

const optional = (value: unknown, type: 'string' | 'boolean') => value === undefined || typeof value === type;

function isShown(value: unknown): value is ShownNotification {
  if (!value || typeof value !== 'object') return false;
  const n = value as { [key: string]: unknown };
  return typeof n.id === 'string' && isAppUrl(n.url) && typeof n.at === 'number'
    && optional(n.tag, 'string') && optional(n.title, 'string') && optional(n.body, 'string') && optional(n.listed, 'boolean');
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

/** Какие из запомненных уведомлений больше не на экране (судить можно только о listed) */
export function splitVanished(list: ShownNotification[], displayedIds: ReadonlySet<string>, now: number) {
  const fresh = parseShown(list, now);
  const isVanished = (n: ShownNotification) => !!n.listed && !displayedIds.has(n.id);
  return {
    kept: fresh.filter(n => !isVanished(n)),
    vanished: fresh.filter(isVanished),
  };
}

/** Исчезло ровно одно — его нажали. Несколько — «Очистить всё», переходить некуда */
export function pickTapped(vanished: ShownNotification[]): ShownNotification | null {
  return vanished.length === 1 ? vanished[0] : null;
}

/** Последнее уведомление, пришедшее пока приложение было в фоне и не убранное с экрана, — для плашки «Открыть» */
export function latestArrived(kept: ShownNotification[], hiddenAt: number): ShownNotification | null {
  const arrived = kept.filter(n => n.at >= hiddenAt);
  return arrived.length ? arrived[arrived.length - 1] : null;
}

export interface ResumeAnswer {
  tapped: { id: string; url: string } | null;
  arrived: { id: string; url: string; title: string; body: string } | null;
}

export function parseResumeAnswer(raw: unknown): ResumeAnswer {
  const data = (raw && typeof raw === 'object' ? raw : {}) as { tapped?: unknown; arrived?: unknown };
  const link = (v: unknown) => {
    if (!v || typeof v !== 'object') return null;
    const { id, url, title, body } = v as { [key: string]: unknown };
    if (typeof id !== 'string' || !isAppUrl(url)) return null;
    return { id, url, title: typeof title === 'string' ? title : '', body: typeof body === 'string' ? body : '' };
  };
  const tapped = link(data.tapped);
  return { tapped: tapped && { id: tapped.id, url: tapped.url }, arrived: link(data.arrived) };
}

/** Журнал событий уведомлений для диагностики (Настройки → это устройство) */
export const NAV_LOG_KEY = '/__nav-log';
export const NAV_LOG_QUERY_MESSAGE = 'NAV_LOG';
export const NAV_LOG_MAX = 80;

export function parseLog(log: unknown): string[] {
  return Array.isArray(log) ? log.filter((l): l is string => typeof l === 'string') : [];
}

export function appendLog(log: unknown, line: string): string[] {
  return [...parseLog(log), line].slice(-NAV_LOG_MAX);
}

export function logLine(source: string, event: string, details: unknown, at: number): string {
  const time = new Date(at).toISOString().slice(11, 23);
  return `${time} ${source} ${event}${details === undefined ? '' : ` ${JSON.stringify(details)}`}`;
}
