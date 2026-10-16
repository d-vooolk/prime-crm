import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Нажали на пуш-уведомление, а приложение уже открыто: service worker присылает ссылку
 * сообщением NAVIGATE (см. sw.ts, notificationclick), переходим по ней без перезагрузки.
 * Подключается в Layout.
 */
export function useNotificationNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: unknown } | null;
      if (data?.type !== 'NAVIGATE' || typeof data.url !== 'string' || !data.url.startsWith('/')) return;
      navigate(data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
}
