import http from './http';

export const pushApi = {
  /** null — пуши на сервере не настроены */
  getPublicKey: () =>
    http.get<{ data: { publicKey: string | null } }>('/push/public-key').then(r => r.data.data.publicKey),

  subscribe: (subscription: PushSubscriptionJSON) =>
    http.post('/push/subscribe', subscription),

  unsubscribe: (endpoint: string) =>
    http.post('/push/unsubscribe', { endpoint }),

  test: () => http.post('/push/test'),
};
