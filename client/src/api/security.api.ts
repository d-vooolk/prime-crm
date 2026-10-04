import http from './http';

export const securityApi = {
  /** Тревожная кнопка «Протокол AID». done — сработала (сессия уже отозвана) */
  hiddenRecords: (pin: string) =>
    http.post<{ data: unknown[]; done?: boolean }>('/security/hidden-records', { pin }).then(r => r.data),
};
