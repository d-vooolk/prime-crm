import http from './http';
import { Record, ForeignCurrency, CurrencyPart, ClientSource, RecordMedia } from '@/types';

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
  executorSignatoryName?: string | null;
  executorSignatoryNameGenitive?: string | null;
  executorSignatoryPosition?: string | null;
  executorSignatoryPositionGenitive?: string | null;
  executorSignatoryBasis?: string | null;
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
  executorSignatoryName?: string;
  executorSignatoryNameGenitive?: string;
  executorSignatoryPosition?: string;
  executorSignatoryPositionGenitive?: string;
  executorSignatoryBasis?: string;
  clientSource?: ClientSource | null;
  items: Array<{ serviceId: string; price: number; quantity: number; netProfit?: number; servicemanName?: string | null; equipmentId?: string; servicemanSplit?: Array<{ name: string; amount: number }> | null; prepaidAmount?: number; prepaidByCard?: boolean; prepaidCurrency?: ForeignCurrency | null; prepaidCurrencyAmount?: number | null; prepaidRate?: number | null }>;
}

export interface CloseDealDto {
  finalPrice: number;
  defects?: string;
  recommendations?: string;
  warranty?: string;
  isPaidByBankTransfer?: boolean;
  splitCashAmount?: number;
  splitCardAmount?: number;
  currencyPayments?: CurrencyPart[];
}

export const recordsApi = {
  getByDate: (date: string, signal?: AbortSignal) =>
    http.get<{ data: Record[] }>('/records', { params: { date }, signal }).then(r => r.data.data),

  getDatesWithRecords: (year: number, month: number, signal?: AbortSignal) =>
    http.get<{ data: string[] }>('/records/dates', { params: { year, month }, signal }).then(r => r.data.data),

  getIncomplete: (signal?: AbortSignal) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return http.get<{ data: Record[] }>('/records/incomplete', { params: { date: date.toISOString() }, signal }).then(r => r.data.data);
  },

  getClosedOnDate: (date: string) =>
    http.get<{ data: Record[] }>('/records/closed-on', { params: { date } }).then(r => r.data.data),

  getById: (id: string) =>
    http.get<{ data: Record }>(`/records/${id}`).then(r => r.data.data),

  // Фото и видео нюансов авто — хранятся год
  getMedia: (recordId: string) =>
    http.get<{ data: RecordMedia[] }>(`/records/${recordId}/media`).then(r => r.data.data),

  uploadMedia: (recordId: string, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<{ data: RecordMedia }>(`/records/${recordId}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress: e => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then(r => r.data.data);
  },

  deleteMedia: (recordId: string, mediaId: string) =>
    http.delete(`/records/${recordId}/media/${mediaId}`),

  create: (data: CreateRecordDto) =>
    http.post<{ data: Record }>('/records', data).then(r => r.data.data),

  update: (id: string, data: Partial<CreateRecordDto>) =>
    http.patch<{ data: Record }>(`/records/${id}`, data).then(r => r.data.data),

  close: (id: string, data: CloseDealDto) =>
    http.post<{ data: Record }>(`/records/${id}/close`, data).then(r => r.data.data),

  cancel: (id: string, body?: { retainedCashAmount?: number; retainedCardAmount?: number }) =>
    http.post<{ data: Record }>(`/records/${id}/cancel`, body || {}).then(r => r.data.data),

  restore: (id: string) =>
    http.post<{ data: Record }>(`/records/${id}/restore`).then(r => r.data.data),

  searchCompanies: (search: string) =>
    http.get<{ data: CompanySuggestion[] }>('/records/companies', { params: { search } }).then(r => r.data.data),

  sendSms: (id: string, type: 'CAR_READY' | 'REVIEW_REQUEST') =>
    http.post<{ ok: boolean; result: 'sent' | 'failed' | 'skipped' | 'disabled' }>(
      `/records/${id}/send-sms`, { type },
    ).then(r => r.data),

  setDefects: (id: string, defects: string | null) =>
    http.patch<{ data: Record }>(`/records/${id}/defects`, { defects }).then(r => r.data.data),

  setSalaryDate: (id: string, salaryDate: string | null) =>
    http.patch(`/records/${id}/salary-date`, { salaryDate }),

  delete: (id: string) =>
    http.delete(`/records/${id}`),
};
