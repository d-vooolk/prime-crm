/// <reference lib="webworker" />
/**
 * Service worker приложения (PWA). Собирается workbox InjectManifest только в продакшен-сборке.
 *  - оболочка приложения (JS/CSS/HTML) лежит в кеше — открывается мгновенно и без сети;
 *  - фото/видео (/api/uploads) — из кеша: имена файлов уникальны, содержимое не меняется;
 *  - данные API (GET) — всегда из сети, а без сети — последний полученный ответ;
 *  - пуш-уведомления и переход по нажатию на них.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

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

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/uploads/') && request.method === 'GET',
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

self.addEventListener('message', (event) => {
  // Новая версия ждёт — пользователь нажал «Обновить»
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  // Выход из аккаунта: данные прошлого пользователя не должны остаться на устройстве
  if (event.data?.type === 'CLEAR_USER_CACHE') {
    event.waitUntil(Promise.all([caches.delete(API_CACHE), caches.delete(UPLOADS_CACHE)]).then(() => undefined));
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
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/maskable-192.png',
    data: { url: data.url || '/schedule' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/schedule';
  event.waitUntil((async () => {
    // Уже открытое окно приложения — переводим его на нужную страницу, иначе открываем новое
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      await existing.navigate(url).catch(() => undefined);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
