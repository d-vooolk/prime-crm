import http from './http';
import { MailListItem, MailMessage, MailStatus } from '@/types';

export interface MailListParams {
  page: number;
  pageSize: number;
  q?: string;
  unread?: boolean;
}

export const mailApi = {
  getList: (params: MailListParams, signal?: AbortSignal) =>
    http.get<{ data: { items: MailListItem[]; total: number } }>('/mail', {
      params: { page: params.page, pageSize: params.pageSize, q: params.q || undefined, unread: params.unread ? '1' : undefined },
      signal,
    }).then(r => r.data.data),

  getUnreadCount: () =>
    http.get<{ data: number }>('/mail/unread-count').then(r => r.data.data),

  getStatus: () =>
    http.get<{ data: MailStatus }>('/mail/status').then(r => r.data.data),

  sync: () =>
    http.post<{ data: MailStatus }>('/mail/sync').then(r => r.data.data),

  /** Открытое письмо сервер помечает прочитанным */
  getMessage: (id: string) =>
    http.get<{ data: MailMessage }>(`/mail/${id}`).then(r => r.data.data),

  setRead: (id: string, isRead: boolean) =>
    http.patch(`/mail/${id}`, { isRead }),

  markAllRead: () =>
    http.post('/mail/read-all'),

  deleteMessage: (id: string) =>
    http.delete(`/mail/${id}`),

  /** Вложение отдаётся только с токеном, поэтому качаем через http, а не ссылкой */
  getAttachment: (id: string) =>
    http.get<Blob>(`/mail/attachments/${id}`, { responseType: 'blob' }).then(r => r.data),
};
