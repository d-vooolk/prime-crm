import { usePwaStore, InstallPromptEvent } from '@/store/pwaStore';
import { pushApi } from '@/api/push.api';

/**
 * PWA: регистрация service worker, обновление версии, установка на устройство и пуш-подписка.
 * Service worker есть только в продакшен-сборке (см. webpack.config.js).
 */

/** Запущено как установленное приложение (с иконки), а не во вкладке браузера */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Флаг «на этом устройстве включены пуши»: напоминания заметок тогда приходят пушем с сервера,
// а не дублируются уведомлением из открытой вкладки (useNotesNotifications)
const PUSH_FLAG = 'prime-crm-push-enabled';
export const isPushEnabledHere = () => localStorage.getItem(PUSH_FLAG) === '1';

let waitingWorker: ServiceWorker | null = null;

export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setInstallPrompt(e as InstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => usePwaStore.getState().setInstallPrompt(null));

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const markWaiting = (worker: ServiceWorker | null) => {
        // Новая версия установилась, а старая ещё управляет страницей — предлагаем обновить
        if (worker && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          usePwaStore.getState().setUpdateReady(true);
        }
      };
      markWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') markWaiting(installing);
        });
      });
      // Приложение на телефоне может неделями не перезагружаться — проверяем обновления раз в час
      setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000);
    } catch {
      // Намеренно молча: без service worker приложение работает как обычный сайт
    }
  });

  // Новая версия взяла управление — перезагружаемся один раз
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  // Выход из аккаунта: убираем данные пользователя с устройства и его пуш-подписку
  window.addEventListener('prime-crm:logout', () => { void forgetUserOnDevice(); });
}

/** Применить скачанную новую версию (перезагрузка произойдёт по controllerchange) */
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

export async function promptInstall(): Promise<boolean> {
  const prompt = usePwaStore.getState().installPrompt;
  if (!prompt) return false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  usePwaStore.getState().setInstallPrompt(null);
  return outcome === 'accepted';
}

function base64UrlToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Включить уведомления на этом устройстве. Бросает Error с понятным текстом */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error(isIos() && !isStandalone()
      ? 'На iPhone уведомления работают только в установленном приложении: «Поделиться» → «На экран Домой»'
      : 'Этот браузер не поддерживает уведомления');
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('Уведомления доступны в рабочей версии приложения');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Уведомления запрещены в настройках браузера — разрешите их для этого сайта');
  }
  const publicKey = await pushApi.getPublicKey();
  if (!publicKey) throw new Error('Уведомления на сервере пока не настроены');
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
  await pushApi.subscribe(subscription.toJSON());
  localStorage.setItem(PUSH_FLAG, '1');
}

export async function disablePush(): Promise<void> {
  const subscription = await getPushSubscription();
  localStorage.removeItem(PUSH_FLAG);
  if (!subscription) return;
  await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}

/**
 * После выхода: подписка отписывается в браузере (на сервере она отвалится сама при первой
 * отправке — 410), кеш ответов API и фото очищается, чтобы не достался следующему пользователю.
 */
async function forgetUserOnDevice() {
  localStorage.removeItem(PUSH_FLAG);
  try {
    const subscription = await getPushSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Намеренно молча: подписки могло не быть
  }
  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_USER_CACHE' });
}
