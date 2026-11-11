/// <reference lib="webworker" />
/**
 * Service worker приложения (PWA). Собирается workbox InjectManifest только в продакшен-сборке.
 *  - оболочка приложения (JS/CSS/HTML) лежит в кеше — открывается мгновенно и без сети;
 *  - фото (/api/uploads) — из кеша: имена файлов уникальны, содержимое не меняется;
 *    видео — всегда из сети: плеер запрашивает его кусками (Range), а CacheFirst отдавал бы
 *    файл целиком — iPhone такое видео не проигрывает;
 *  - данные API (GET) — всегда из сети, а без сети — последний полученный ответ;
 *  - пуш-уведомления и переход по нажатию на них.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import {
  NAVIGATE_MESSAGE, NAV_LOG_KEY, NAV_LOG_QUERY_MESSAGE, NOTIFICATIONS_SYNC_MESSAGE, PENDING_NAV_CACHE, PENDING_NAV_KEY,
  SHOWN_NOTIFICATIONS_KEY, TAPPED_QUERY_MESSAGE, PendingNavigation, ResumeAnswer, ShownNotification,
  addShown, appendLog, isAppUrl, isFreshSync, latestArrived, logLine, parseLog, parseShown, pickTapped, splitVanished,
} from './pwa/notificationNavigation';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

/** Кеш ответов API: очищается при выходе из аккаунта (сообщение CLEAR_USER_CACHE) */
const API_CACHE = 'prime-api';
const UPLOADS_CACHE = 'prime-uploads';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Любой переход внутри приложения отдаёт index.html из кеша, кроме API и файлов
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//, /^\/health/],
}));

const VIDEO_FILE = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i;

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/uploads/')
    && request.method === 'GET'
    && request.destination !== 'video'
    && !request.headers.has('range')
    && !VIDEO_FILE.test(url.pathname),
  new CacheFirst({
    cacheName: UPLOADS_CACHE,
    plugins: [
      // 0 — непрозрачные ответы, 206 не кешируем (Range-запросы видео)
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/')
    && request.method === 'GET'
    && !url.pathname.startsWith('/api/uploads/')
    && !url.pathname.startsWith('/api/auth/')
    && !url.pathname.startsWith('/api/push/'),
  new NetworkFirst({
    cacheName: API_CACHE,
    // Без таймаута: сохранённое показываем только когда сети нет совсем, а не когда сервер
    // считает долго — иначе на медленном отчёте молча показали бы устаревшие цифры
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 3 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

// Шрифт Inter с Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'prime-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
);

/** Журнал событий уведомлений для диагностики (Настройки → это устройство). Пишется последовательно */
let logQueue: Promise<void> = Promise.resolve();
function log(event: string, details?: unknown): Promise<void> {
  logQueue = logQueue.then(async () => {
    const cache = await caches.open(PENDING_NAV_CACHE);
    const res = await cache.match(NAV_LOG_KEY);
    const lines = appendLog(res ? await res.json() : [], logLine('sw', event, details, Date.now()));
    await cache.put(NAV_LOG_KEY, new Response(JSON.stringify(lines), { headers: { 'Content-Type': 'application/json' } }));
  }).catch(() => undefined);
  return logQueue;
}

async function readLog(): Promise<string[]> {
  await logQueue;
  const cache = await caches.open(PENDING_NAV_CACHE);
  const res = await cache.match(NAV_LOG_KEY);
  return parseLog(res ? await res.json() : []);
}

/** Запомненные показанные уведомления (pwa/notificationNavigation.ts, iPhone с приложением в фоне) */
async function readShown(): Promise<ShownNotification[]> {
  const cache = await caches.open(PENDING_NAV_CACHE);
  const res = await cache.match(SHOWN_NOTIFICATIONS_KEY);
  return parseShown(res ? await res.json() : null, Date.now());
}

async function writeShown(list: ShownNotification[]) {
  const cache = await caches.open(PENDING_NAV_CACHE);
  await cache.put(SHOWN_NOTIFICATIONS_KEY, new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }));
}

async function forgetShown(id: string) {
  const list = await readShown();
  if (list.some(n => n.id === id)) await writeShown(list.filter(n => n.id !== id));
}

const notificationId = (n: Notification) => (n.data as { id?: unknown } | null)?.id;

async function displayedIds(): Promise<Set<string>> {
  const displayed = await self.registration.getNotifications();
  return new Set(displayed.map(notificationId).filter((id): id is string => typeof id === 'string'));
}

/** Убрать из списка исчезнувшие с экрана уведомления */
async function takeVanished() {
  const list = await readShown();
  const ids = await displayedIds();
  const { kept, vanished } = splitVanished(list, ids, Date.now());
  if (vanished.length) await writeShown(kept);
  return { list, ids, kept, vanished };
}

/** Приложение вернулось из фона: нажатое уведомление и последнее пришедшее, пока оно было скрыто */
async function resumeAnswer(hiddenAt: number): Promise<ResumeAnswer> {
  const { list, ids, kept, vanished } = await takeVanished();
  const tapped = pickTapped(vanished);
  const arrived = tapped ? null : latestArrived(kept, hiddenAt);
  await log('resume', {
    hiddenAt: new Date(hiddenAt).toISOString().slice(11, 19),
    stored: list.map(n => `${n.tag ?? n.id}${n.listed ? '' : '(unlisted)'}`),
    displayed: ids.size,
    vanished: vanished.map(n => n.tag ?? n.id),
    tapped: tapped?.url ?? null,
    arrived: arrived?.url ?? null,
  });
  return {
    tapped: tapped && { id: tapped.id, url: tapped.url },
    arrived: arrived && { id: arrived.id, url: arrived.url, title: arrived.title ?? '', body: arrived.body ?? '' },
  };
}

self.addEventListener('message', (event) => {
  // Новая версия ждёт — пользователь нажал «Обновить»
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  // Выход из аккаунта: данные прошлого пользователя не должны остаться на устройстве
  if (event.data?.type === 'CLEAR_USER_CACHE') {
    event.waitUntil(Promise.all([caches.delete(API_CACHE), caches.delete(UPLOADS_CACHE)]).then(() => undefined));
  }
  // Приложение уходит в фон: уведомления, убранные при открытом приложении, нажатием не считаем
  if (event.data?.type === NOTIFICATIONS_SYNC_MESSAGE) {
    const fresh = isFreshSync(event.data.at, Date.now());
    event.waitUntil((fresh ? takeVanished() : Promise.resolve(null))
      .then(r => log('sync', { fresh, vanished: r?.vanished.map(n => n.tag ?? n.id) ?? null }))
      .catch(() => undefined));
  }
  // Приложение вернулось из фона: не нажали ли уведомление (на iPhone notificationclick тогда не приходит)
  if (event.data?.type === TAPPED_QUERY_MESSAGE) {
    const port = event.ports[0];
    const hiddenAt = typeof event.data.hiddenAt === 'number' ? event.data.hiddenAt : Date.now();
    event.waitUntil(resumeAnswer(hiddenAt)
      .catch(async (e: unknown) => {
        await log('resume-error', String(e));
        return { tapped: null, arrived: null };
      })
      .then((answer) => { port?.postMessage(answer); }));
  }
  if (event.data?.type === NAV_LOG_QUERY_MESSAGE) {
    const port = event.ports[0];
    event.waitUntil(readLog().catch(() => []).then((lines) => { port?.postMessage(lines); }));
  }
});

interface PushPayload { title: string; body: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Prime CRM', body: '' };
  try {
    data = { ...data, ...(event.data?.json() as PushPayload) };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const shown: ShownNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: isAppUrl(data.url) ? data.url : '/schedule',
    tag: data.tag,
    title: data.title,
    body: data.body,
    at: Date.now(),
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/maskable-192.png',
      data: { url: shown.url, id: shown.id },
    });
    // По исчезновению с экрана судим, только если браузер честно отдаёт список показанных уведомлений
    const ids = await displayedIds().catch(() => new Set<string>());
    shown.listed = ids.has(shown.id);
    await writeShown(addShown(await readShown(), shown, Date.now()));
    await log('push', { tag: shown.tag, url: shown.url, listed: shown.listed, displayed: ids.size });
  })().catch((e: unknown) => log('push-error', String(e))));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string; id?: string } | undefined;
  const url = data?.url || '/schedule';
  event.waitUntil((async () => {
    // Ссылка сначала ложится в кеш — при любом исходе ниже: окно в фоне «заморожено» и сообщение
    // может потерять, а на iPhone свёрнутое приложение иногда не попадает в matchAll, и openWindow()
    // лишь разворачивает его, не переходя по ссылке. Приложение забирает её, когда снова видно
    // id уведомления — тот же, что вернёт проверка исчезнувших: переход по нему случится один раз
    const pending: PendingNavigation = { id: data?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, at: Date.now() };
    await caches.open(PENDING_NAV_CACHE)
      .then(cache => cache.put(PENDING_NAV_KEY, new Response(JSON.stringify(pending), { headers: { 'Content-Type': 'application/json' } })))
      .catch(() => undefined);
    if (data?.id) await forgetShown(data.id).catch(() => undefined);

    // Уже открытое окно приложения — переводим его на нужную страницу, иначе открываем новое.
    // Переход делает само приложение по сообщению (useNotificationNavigation): WindowClient.navigate()
    // не работает в окне, которым этот service worker не управляет, и на iOS, а заодно перезагружал бы страницу
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.filter(w => new URL(w.url).origin === self.location.origin);
    const existing = sameOrigin.find(w => w.focused) ?? sameOrigin.find(w => w.visibilityState === 'visible') ?? sameOrigin[0];
    await log('click', { url, windows: sameOrigin.length, existing: existing?.visibilityState ?? null });
    if (existing) {
      // Сообщение — до focus(): на iOS focus() может не завершиться, и переход не случался
      existing.postMessage({ type: NAVIGATE_MESSAGE, url, id: pending.id });
      await existing.focus().catch(() => undefined);
      return;
    }
    await self.clients.openWindow(url).catch(() => null);
  })());
});

// Уведомление смахнули (Android, компьютер) — нажатием его потом не считаем
self.addEventListener('notificationclose', (event) => {
  const id = notificationId(event.notification);
  if (typeof id === 'string') event.waitUntil(forgetShown(id).then(() => log('close', id)).catch(() => undefined));
});
