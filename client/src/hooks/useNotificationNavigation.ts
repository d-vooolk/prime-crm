import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button } from 'antd';
import {
  NAVIGATE_MESSAGE, PENDING_NAV_CACHE, PENDING_NAV_KEY, PENDING_NAV_POLL_MS, PENDING_NAV_WAIT_MS,
  RecentPush, appendLog, isAppUrl, logLine, parseLog, resumeAction, takePending,
} from '@/pwa/notificationNavigation';
import { isIos, isStandalone } from '@/pwa';
import { pushApi } from '@/api/push.api';

/** Уже выполненные переходы: сообщение и кеш несут одну ссылку, переходим по ней один раз */
const handled = new Set<string>();
/** Уведомления, уже предложенные плашкой «Открыть» */
const offered = new Set<string>();

const LOG_KEY = 'prime-nav-log';

/** Журнал событий уведомлений на этом устройстве — для диагностики (см. readNavLog) */
function navLog(event: string, details?: unknown) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(appendLog(JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'), logLine(event, details, Date.now()))));
  } catch {
    // Намеренно молча: журнал — только для диагностики
  }
}

/** Журнал событий уведомлений — Настройки → это устройство → «Журнал» */
export function readNavLog(): string[] {
  try {
    return parseLog(JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

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
 * когда приложение снова видно (pwa/notificationNavigation.ts). А на iPhone с приложением в фоне
 * service worker о нажатии не узнаёт вовсе — тогда после возврата спрашиваем сервер, что пришло,
 * пока приложение было свёрнуто (pwa/notificationNavigation.ts, resumeAction). Подключается в Layout.
 */
export function useNotificationNavigation() {
  const navigate = useNavigate();
  const { notification } = App.useApp();
  // Только iPhone: в остальных браузерах нажатие доходит до service worker
  const askServer = isIos() && isStandalone();
  const navigateRef = useRef(navigate);
  const notificationRef = useRef(notification);
  useEffect(() => {
    navigateRef.current = navigate;
    notificationRef.current = notification;
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };
    // Когда приложение ушло в фон; null — сейчас на экране
    let hiddenAt: number | null = document.visibilityState === 'visible' ? null : Date.now();

    const go = (url: string, id: string | undefined, via: string) => {
      if (id) {
        if (handled.has(id)) return;
        handled.add(id);
      }
      navLog('go', { url, via });
      stopPolling();
      notificationRef.current.destroy('notification-open');
      navigateRef.current(url);
    };

    const checkPending = () => {
      readPending()
        .then(raw => {
          const pending = takePending(raw, Date.now(), handled);
          if (pending) go(pending.url, pending.id, 'cache');
        })
        .catch(() => {
          // Намеренно молча: без кеша остаётся переход по сообщению
        });
    };

    const offer = (push: RecentPush) => {
      notificationRef.current.open({
        key: 'notification-open',
        message: push.title || 'Новое уведомление',
        description: push.body,
        duration: 15,
        btn: React.createElement(Button, {
          type: 'primary',
          onClick: () => go(push.url, push.id, 'offer'),
        }, 'Открыть'),
      });
    };

    const checkRecent = (hiddenFor: number, retry = true) => {
      pushApi.recent(hiddenFor)
        .then(push => {
          const action = resumeAction(push, handled);
          navLog('recent', { url: push?.url ?? null, ageS: push && Math.round(push.ageMs / 1000), action });
          if (!push || !action) return;
          if (action === 'go') go(push.url, push.id, 'server');
          else if (!offered.has(push.id)) {
            offered.add(push.id);
            offer(push);
          }
        })
        .catch((e: unknown) => {
          navLog('recent-error', e instanceof Error ? e.message : String(e));
          // Сразу после возврата из фона сеть на телефоне бывает ещё не готова
          if (retry) setTimeout(() => checkRecent(hiddenFor + 1500, false), 1500);
        });
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: unknown; id?: unknown } | null;
      if (data?.type !== NAVIGATE_MESSAGE || !isAppUrl(data.url)) return;
      go(data.url, typeof data.id === 'string' ? data.id : undefined, 'message');
    };

    // Service worker кладёт ссылку в кеш позже, чем окно становится видимым (на iPhone он
    // при нажатии часто запускается с нуля), — после показа смотрим в кеш ещё несколько секунд
    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        if (hiddenAt !== null) return;
        hiddenAt = Date.now();
        navLog('hidden');
        return;
      }
      stopPolling();
      checkPending();
      if (hiddenAt !== null) {
        const hiddenFor = Date.now() - hiddenAt;
        hiddenAt = null;
        navLog('visible', { hiddenS: Math.round(hiddenFor / 1000) });
        // Запас в 5 секунд: пуш мог уйти с сервера чуть раньше, чем телефон заметил уход в фон
        if (askServer) checkRecent(hiddenFor + 5000);
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
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [askServer]);
}
