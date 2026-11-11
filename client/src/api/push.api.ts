import http from './http';
import type { RecentPush } from '@/pwa/notificationNavigation';

export const pushApi = {
  /** null — пуши на сервере не настроены */
  getPublicKey: () =>
    http.get<{ data: { publicKey: string | null } }>('/push/public-key').then(r => r.data.data.publicKey),

  subscribe: (subscription: PushSubscriptionJSON) =>
    http.post('/push/subscribe', subscription),

  unsubscribe: (endpoint: string) =>
    http.post('/push/unsubscribe', { endpoint }),

  test: () => http.post('/push/test'),

  /** Последний пуш, пришедший, пока приложение было свёрнуто hiddenFor мс (iPhone, см. useNotificationNavigation) */
  recent: (hiddenFor: number) =>
    http.get<{ data: RecentPush | null }>('/push/recent', { params: { hiddenFor: Math.round(hiddenFor) } }).then(r => r.data.data),
};
