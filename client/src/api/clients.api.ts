import http from './http';
import { Client, ClientWithRecords } from '@/types';

/** Фильтры списка клиентов. Пустые поля не отправляются, заданные комбинируются через И. */
export interface ClientsFilter {
  /** Общий поиск по имени или телефону как есть */
  search?: string;
  /** Цифры телефона — ищутся в любом месте номера */
  phone?: string;
  /** Часть ФИО, без учёта регистра */
  name?: string;
  brandId?: string;
  modelId?: string;
  generationId?: string;
  /** Часть госномера; пробелы, дефисы и кириллица/латиница не важны */
  plate?: string;
  /** Клиенты, которым делали услугу (в неотменённой записи) */
  serviceId?: string;
  /** Период записи YYYY-MM-DD, включительно */
  from?: string;
  to?: string;
}

export const clientsApi = {
  getAll: (filter: ClientsFilter = {}, signal?: AbortSignal) =>
    http.get<{ data: Client[] }>('/clients', { params: filter, signal }).then(r => r.data.data),

  /** Подсказки для автодополнения по имени — клиенты вместе с их авто */
  suggest: (q: string, signal?: AbortSignal) =>
    http.get<{ data: Client[] }>('/clients/suggest', { params: { q }, signal }).then(r => r.data.data),

  searchByPhone: (phone: string) =>
    http.get<{ data: Client[] }>('/clients/search', { params: { phone } }).then(r => r.data.data),

  getById: (id: string) =>
    http.get<{ data: ClientWithRecords }>(`/clients/${id}`).then(r => r.data.data),

  create: (data: { name: string; phone: string; notes?: string }) =>
    http.post<{ data: Client }>('/clients', data).then(r => r.data.data),

  update: (id: string, data: Partial<{ name: string; phone: string; notes: string }>) =>
    http.patch<{ data: Client }>(`/clients/${id}`, data).then(r => r.data.data),
};
