import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NAVIGATE_MESSAGE, PENDING_NAV_CACHE, PENDING_NAV_KEY, PENDING_NAV_POLL_MS, PENDING_NAV_WAIT_MS,
  isAppUrl, takePending,
} from '@/pwa/notificationNavigation';

/** Уже выполненные переходы: сообщение и кеш несут одну ссылку, переходим по ней один раз */
const handled = new Set<string>();

async function readPending(): Promise<unknown> {
  if (!('caches' in window)) return null;
  const cache = await caches.open(PENDING_NAV_CACHE);
  const res = await cache.match(PENDING_NAV_KEY);
  if (!res) return null;
  await cache.delete(PENDING_NAV_KEY);
  return res.json();
}

/**
 * Нажали на пуш-уведомление, а приложение уже открыто: service worker присылает ссылку
 * сообщением NAVIGATE (см. sw.ts, notificationclick), переходим по ней без перезагрузки.
 * Окно в фоне сообщение может не получить — тогда ссылка забирается из кеша,
 * когда приложение снова видно (pwa/notificationNavigation.ts). Подключается в Layout.
 */
export function useNotificationNavigation() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    const go = (url: string, id?: string) => {
      if (id) {
        if (handled.has(id)) return;
        handled.add(id);
      }
      stopPolling();
      navigateRef.current(url);
    };

    const checkPending = () => {
      readPending()
        .then(raw => {
          const pending = takePending(raw, Date.now(), handled);
          if (pending) go(pending.url, pending.id);
        })
        .catch(() => {
          // Намеренно молча: без кеша остаётся переход по сообщению
        });
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: unknown; id?: unknown } | null;
      if (data?.type !== NAVIGATE_MESSAGE || !isAppUrl(data.url)) return;
      go(data.url, typeof data.id === 'string' ? data.id : undefined);
    };

    // Service worker кладёт ссылку в кеш позже, чем окно становится видимым (на iPhone он
    // при нажатии часто запускается с нуля), — после показа смотрим в кеш ещё несколько секунд
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      stopPolling();
      checkPending();
      const startedAt = Date.now();
      poll = setInterval(() => {
        if (document.visibilityState !== 'visible' || Date.now() - startedAt > PENDING_NAV_WAIT_MS) {
          stopPolling();
          return;
        }
        checkPending();
      }, PENDING_NAV_POLL_MS);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.startMessages();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    onVisible();
    return () => {
      stopPolling();
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
}
