import http from './http';
import { Client, ClientWithRecords } from '@/types';

export const clientsApi = {
  getAll: (search?: string) =>
    http.get<{ data: Client[] }>('/clients', { params: { search } }).then(r => r.data.data),

  searchByPhone: (phone: string) =>
    http.get<{ data: Client[] }>('/clients/search', { params: { phone } }).then(r => r.data.data),

  getById: (id: string) =>
    http.get<{ data: ClientWithRecords }>(`/clients/${id}`).then(r => r.data.data),

  create: (data: { name: string; phone: string; notes?: string }) =>
    http.post<{ data: Client }>('/clients', data).then(r => r.data.data),

  update: (id: string, data: Partial<{ name: string; phone: string; notes: string }>) =>
    http.patch<{ data: Client }>(`/clients/${id}`, data).then(r => r.data.data),
};
