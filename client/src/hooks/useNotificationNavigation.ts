import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NAVIGATE_MESSAGE, NOTIFICATIONS_SYNC_MESSAGE, PENDING_NAV_CACHE, PENDING_NAV_KEY, PENDING_NAV_POLL_MS, PENDING_NAV_WAIT_MS,
  TAPPED_CHECK_DELAYS_MS, TAPPED_QUERY_MESSAGE, isAppUrl, takePending,
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

async function activeWorker(): Promise<ServiceWorker | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.active ?? null;
}

/** Спросить service worker, какое уведомление нажали, пока приложение было в фоне */
async function askTapped(): Promise<{ id: string; url: string } | null> {
  const worker = await activeWorker();
  if (!worker) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      const data = event.data as { id?: unknown; url?: unknown } | null;
      resolve(data && typeof data.id === 'string' && isAppUrl(data.url) ? { id: data.id, url: data.url } : null);
    };
    worker.postMessage({ type: TAPPED_QUERY_MESSAGE }, [channel.port2]);
  });
}

/**
 * Нажали на пуш-уведомление, а приложение уже открыто: service worker присылает ссылку
 * сообщением NAVIGATE (см. sw.ts, notificationclick), переходим по ней без перезагрузки.
 * Окно в фоне сообщение может не получить — тогда ссылка забирается из кеша,
 * когда приложение снова видно (pwa/notificationNavigation.ts). А на iPhone с приложением в фоне
 * service worker о нажатии не узнаёт вовсе — тогда после возврата спрашиваем у него, какое из
 * показанных уведомлений исчезло. Подключается в Layout.
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
    let tappedChecks: ReturnType<typeof setTimeout>[] = [];
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };
    const stopTappedChecks = () => {
      tappedChecks.forEach(clearTimeout);
      tappedChecks = [];
    };
    // Приложение было скрыто — после показа проверяем, не нажали ли уведомление
    let wasHidden = false;

    const go = (url: string, id?: string) => {
      if (id) {
        if (handled.has(id)) return;
        handled.add(id);
      }
      stopPolling();
      stopTappedChecks();
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

    const checkTapped = () => {
      askTapped()
        .then(tapped => {
          if (tapped) go(tapped.url, tapped.id);
        })
        .catch(() => {
          // Намеренно молча: остаются сообщение и кеш
        });
    };

    // Service worker кладёт ссылку в кеш позже, чем окно становится видимым (на iPhone он
    // при нажатии часто запускается с нуля), — после показа смотрим в кеш ещё несколько секунд
    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        if (wasHidden) return;
        wasHidden = true;
        // Убранные при открытом приложении уведомления потом не должны сойти за нажатые.
        // Отправка синхронная: окно в фоне сразу замирает, а дошедшее после возврата сообщение
        // убрало бы и нажатое уведомление — поэтому в нём ещё и время ухода
        navigator.serviceWorker.controller?.postMessage({ type: NOTIFICATIONS_SYNC_MESSAGE, at: Date.now() });
        return;
      }
      stopPolling();
      checkPending();
      if (wasHidden) {
        wasHidden = false;
        stopTappedChecks();
        tappedChecks = TAPPED_CHECK_DELAYS_MS.map(delay => setTimeout(checkTapped, delay));
      }
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
      stopTappedChecks();
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
}
