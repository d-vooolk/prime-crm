import http from './http';
import { Record } from '@/types';

export interface CompanySuggestion {
  legalCompanyName: string;
  legalAddress?: string | null;
  legalActualAddress?: string | null;
  legalPostalAddress?: string | null;
  legalBankDetails?: string | null;
  legalBic?: string | null;
  legalUnp?: string | null;
  legalOkpo?: string | null;
  legalPhone?: string | null;
  legalEmail?: string | null;
  legalRepresentativePosition?: string | null;
  legalRepresentativePositionGenitive?: string | null;
  legalRepresentative?: string | null;
  legalRepresentativeGenitive?: string | null;
  legalBasis?: string | null;
}

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
    mileage?: string;
  };
  scheduledAt: string;
  serviceman: string;
  receptionist?: string;
  notes?: string;
  isLegalEntity?: boolean;
  legalCompanyName?: string;
  legalAddress?: string;
  legalActualAddress?: string;
  legalPostalAddress?: string;
  legalBankDetails?: string;
  legalBic?: string;
  legalUnp?: string;
  legalOkpo?: string;
  legalPhone?: string;
  legalEmail?: string;
  legalRepresentativePosition?: string;
  legalRepresentativePositionGenitive?: string;
  legalRepresentative?: string;
  legalRepresentativeGenitive?: string;
  legalBasis?: string;
  legalVin?: string;
  legalEndDate?: string;
  items: Array<{ serviceId: string; price: number; quantity: number }>;
}

export interface CloseDealDto {
  finalPrice: number;
  defects?: string;
  warranty?: string;
  equipmentIds?: string[];
}

export const recordsApi = {
  getByDate: (date: string) =>
    http.get<{ data: Record[] }>('/records', { params: { date } }).then(r => r.data.data),

  getIncomplete: () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return http.get<{ data: Record[] }>('/records/incomplete', { params: { date: date.toISOString() } }).then(r => r.data.data);
  },

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

  restore: (id: string) =>
    http.post<{ data: Record }>(`/records/${id}/restore`).then(r => r.data.data),

  searchCompanies: (search: string) =>
    http.get<{ data: CompanySuggestion[] }>('/records/companies', { params: { search } }).then(r => r.data.data),

  sendSms: (id: string, type: 'CAR_READY' | 'REVIEW_REQUEST') =>
    http.post(`/records/${id}/send-sms`, { type }).then(r => r.data),
};
