import http from './http';
import { Record } from '@/types';

export interface CreateRecordDto {
  clientId: string;
  car: {
    brand: string;
    brandId: string;
    model: string;
    modelId: string;
    generation?: string;
    generationId?: string;
    generationName?: string;
    year: string;
    plateNumber?: string;
  };
  scheduledAt: string;
  serviceman: string;
  notes?: string;
  items: Array<{ serviceId: string; price: number; quantity: number }>;
}

export interface CloseDealDto {
  finalPrice: number;
  priceIncreaseReason?: string;
  warranty?: string;
  equipmentIds?: string[];
}

export const recordsApi = {
  getByDate: (date: string) =>
    http.get<{ data: Record[] }>('/records', { params: { date } }).then(r => r.data.data),

  getIncomplete: () =>
    http.get<{ data: Record[] }>('/records/incomplete').then(r => r.data.data),

  getById: (id: string) =>
    http.get<{ data: Record }>(`/records/${id}`).then(r => r.data.data),

  create: (data: CreateRecordDto) =>
    http.post<{ data: Record }>('/records', data).then(r => r.data.data),

  update: (id: string, data: Partial<CreateRecordDto>) =>
    http.patch<{ data: Record }>(`/records/${id}`, data).then(r => r.data.data),

  close: (id: string, data: CloseDealDto) =>
    http.post<{ data: Record }>(`/records/${id}/close`, data).then(r => r.data.data),

  cancel: (id: string) =>
    http.post<{ data: Record }>(`/records/${id}/cancel`).then(r => r.data.data),
};
