import http from './http';

export type SiteLeadStatus = 'NEW' | 'DONE' | 'RECORDED';

/** Заявка из формы сайта prime-auto.by */
export interface SiteLead {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  /** Страница сайта, с которой отправили */
  page: string | null;
  /** Откуда человек пришёл на сайт */
  source: string | null;
  photoUrls: string[];
  status: SiteLeadStatus;
  handledAt: string | null;
  handledByName: string | null;
  recordId: string | null;
  createdAt: string;
}

export const siteLeadsApi = {
  list: (status: 'new' | 'handled') =>
    http.get<{ data: SiteLead[] }>('/site-leads', { params: { status } }).then(r => r.data.data),

  newCount: () =>
    http.get<{ data: { count: number } }>('/site-leads/count').then(r => r.data.data.count),

  setDone: (id: string, done: boolean) =>
    http.post<{ data: SiteLead }>(`/site-leads/${id}/done`, { done }).then(r => r.data.data),

  /** Привязать созданную запись: фото заявки уходят в «Фото и видео» записи */
  attachRecord: (id: string, recordId: string) =>
    http.post<{ data: SiteLead }>(`/site-leads/${id}/record`, { recordId }).then(r => r.data.data),
};
