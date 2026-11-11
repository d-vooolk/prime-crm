import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button } from 'antd';
import {
  NAVIGATE_MESSAGE, NAV_LOG_QUERY_MESSAGE, NOTIFICATIONS_SYNC_MESSAGE, PENDING_NAV_CACHE, PENDING_NAV_KEY,
  PENDING_NAV_POLL_MS, PENDING_NAV_WAIT_MS, TAPPED_CHECK_DELAYS_MS, TAPPED_QUERY_MESSAGE,
  ResumeAnswer, appendLog, isAppUrl, logLine, parseLog, parseResumeAnswer, takePending,
} from '@/pwa/notificationNavigation';

/** Уже выполненные переходы: сообщение и кеш несут одну ссылку, переходим по ней один раз */
const handled = new Set<string>();
/** Уведомления, уже предложенные плашкой «Открыть» */
const offered = new Set<string>();

const APP_LOG_KEY = 'prime-nav-log';

/** Журнал событий уведомлений на стороне приложения (диагностика, см. readNavLog) */
function appLog(event: string, details?: unknown) {
  try {
    const lines = appendLog(JSON.parse(localStorage.getItem(APP_LOG_KEY) ?? '[]'), logLine('app', event, details, Date.now()));
    localStorage.setItem(APP_LOG_KEY, JSON.stringify(lines));
  } catch {
    // Намеренно молча: журнал — только для диагностики
  }
}

async function activeWorker(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.active ?? null;
}

/** Запрос к service worker с ответом через MessagePort */
async function askWorker(message: object): Promise<unknown> {
  const worker = await activeWorker();
  if (!worker) throw new Error('нет service worker');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('service worker не ответил')), 3000);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Журнал событий уведомлений (приложение + service worker) — Настройки → это устройство */
export async function readNavLog(): Promise<string[]> {
  let swLines: string[] = [];
  try {
    swLines = parseLog(await askWorker({ type: NAV_LOG_QUERY_MESSAGE }));
  } catch (e) {
    swLines = [`service worker: ${e instanceof Error ? e.message : String(e)}`];
  }
  const appLines = parseLog(JSON.parse(localStorage.getItem(APP_LOG_KEY) ?? '[]'));
  return [...swLines, ...appLines].sort();
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
 * service worker о нажатии не узнаёт вовсе — тогда после возврата спрашиваем у него, какое из
 * показанных уведомлений исчезло; не понятно — предлагаем последнее пришедшее плашкой «Открыть».
 * Подключается в Layout.
 */
export function useNotificationNavigation() {
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const navigateRef = useRef(navigate);
  const notificationRef = useRef(notification);
  useEffect(() => {
    navigateRef.current = navigate;
    notificationRef.current = notification;
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    let resumeChecks: ReturnType<typeof setTimeout>[] = [];
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };
    const stopResumeChecks = () => {
      resumeChecks.forEach(clearTimeout);
      resumeChecks = [];
    };
    // Когда приложение ушло в фон; null — сейчас на экране
    let hiddenAt: number | null = document.visibilityState === 'visible' ? null : Date.now();

    const go = (url: string, id: string | undefined, via: string) => {
      if (id) {
        if (handled.has(id)) return;
        handled.add(id);
      }
      appLog('go', { url, via });
      stopPolling();
      stopResumeChecks();
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

    const offer = (arrived: NonNullable<ResumeAnswer['arrived']>) => {
      if (offered.has(arrived.id) || handled.has(arrived.id)) return;
      offered.add(arrived.id);
      appLog('offer', arrived.url);
      notificationRef.current.open({
        key: 'notification-open',
        message: arrived.title || 'Новое уведомление',
        description: arrived.body,
        duration: 15,
        btn: React.createElement(Button, {
          type: 'primary',
          onClick: () => go(arrived.url, arrived.id, 'offer'),
        }, 'Открыть'),
      });
    };

    const checkResume = (since: number, attempt: number, last: boolean) => {
      askWorker({ type: TAPPED_QUERY_MESSAGE, hiddenAt: since })
        .then(raw => {
          const answer = parseResumeAnswer(raw);
          appLog('resume-answer', { attempt, tapped: answer.tapped?.url ?? null, arrived: answer.arrived?.url ?? null });
          if (answer.tapped) go(answer.tapped.url, answer.tapped.id, 'vanished');
          // Плашку — после последней проверки: вдруг нажатое уведомление iOS уберёт чуть позже
          else if (answer.arrived && last) offer(answer.arrived);
        })
        .catch((e: unknown) => appLog('resume-error', e instanceof Error ? e.message : String(e)));
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
        appLog('hidden');
        // Убранные при открытом приложении уведомления потом не должны сойти за нажатые.
        // Отправка синхронная: окно в фоне сразу замирает, а дошедшее после возврата сообщение
        // убрало бы и нажатое уведомление — поэтому в нём ещё и время ухода
        navigator.serviceWorker.controller?.postMessage({ type: NOTIFICATIONS_SYNC_MESSAGE, at: hiddenAt });
        return;
      }
      stopPolling();
      checkPending();
      if (hiddenAt !== null) {
        const since = hiddenAt;
        hiddenAt = null;
        appLog('visible', { hiddenFor: Math.round((Date.now() - since) / 1000) });
        stopResumeChecks();
        resumeChecks = TAPPED_CHECK_DELAYS_MS.map((delay, i) => setTimeout(
          () => checkResume(since, i, i === TAPPED_CHECK_DELAYS_MS.length - 1),
          delay,
        ));
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
      stopResumeChecks();
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
}
