import http from './http';
import { Category, Equipment, Serviceman, CompanySettings, DocumentTemplate, SmsSettings } from '@/types';

export const servicesApi = {
  getCategories: () =>
    http.get<{ data: Category[] }>('/services/categories').then(r => r.data.data),

  createCategory: (name: string) =>
    http.post<{ data: Category }>('/services/categories', { name }).then(r => r.data.data),

  updateCategory: (id: string, name: string) =>
    http.patch<{ data: Category }>(`/services/categories/${id}`, { name }).then(r => r.data.data),

  deleteCategory: (id: string) =>
    http.delete(`/services/categories/${id}`),

  createService: (data: { name: string; categoryId: string; standardPrice: number; estimatedTime: number }) =>
    http.post('/services', data).then(r => r.data),

  updateService: (id: string, data: Partial<{ name: string; categoryId: string; standardPrice: number; estimatedTime: number }>) =>
    http.patch(`/services/${id}`, data).then(r => r.data),

  deleteService: (id: string) =>
    http.delete(`/services/${id}`),

  getEquipment: () =>
    http.get<{ data: Equipment[] }>('/services/equipment').then(r => r.data.data),

  createEquipment: (data: { name: string; warranty?: string; wholesalePrice?: number; retailPrice?: number }) =>
    http.post<{ data: Equipment }>('/services/equipment', data).then(r => r.data.data),

  updateEquipment: (id: string, data: { name?: string; warranty?: string; wholesalePrice?: number; retailPrice?: number }) =>
    http.patch<{ data: Equipment }>(`/services/equipment/${id}`, data).then(r => r.data.data),

  deleteEquipment: (id: string) =>
    http.delete(`/services/equipment/${id}`),

  getServicemen: () =>
    http.get<{ data: Serviceman[] }>('/services/servicemen').then(r => r.data.data),

  getAllServicemen: () =>
    http.get<{ data: Serviceman[] }>('/services/servicemen/all').then(r => r.data.data),

  createServiceman: (data: { name: string; position?: string; role?: string; email?: string; password?: string; isReceptionist?: boolean; birthday?: string | null }) =>
    http.post<{ data: Serviceman }>('/services/servicemen', data).then(r => r.data.data),

  updateServiceman: (id: string, data: { name?: string; position?: string; role?: string; email?: string; password?: string; isReceptionist?: boolean; profitPercent?: number; birthday?: string | null }) =>
    http.patch<{ data: Serviceman }>(`/services/servicemen/${id}`, data).then(r => r.data.data),

  getTodayBirthdays: () =>
    http.get<{ data: { id: string; name: string; position?: string; birthday: string }[] }>('/services/servicemen/today-birthdays').then(r => r.data.data),

  dismissServiceman: (id: string) =>
    http.post<{ data: Serviceman }>(`/services/servicemen/${id}/dismiss`).then(r => r.data.data),

  setDefaultReceptionist: (id: string) =>
    http.post<{ data: Serviceman }>(`/services/servicemen/${id}/set-default`).then(r => r.data.data),

  deleteServiceman: (id: string) =>
    http.delete(`/services/servicemen/${id}`),

  getSettings: () =>
    http.get<{ data: CompanySettings }>('/services/settings').then(r => r.data.data),

  updateSettings: (data: Partial<CompanySettings>) =>
    http.patch<{ data: CompanySettings }>('/services/settings', data).then(r => r.data.data),

  getSmsSettings: () =>
    http.get<{ data: SmsSettings | null }>('/services/sms-settings').then(r => r.data.data),

  updateSmsSettings: (data: Partial<SmsSettings>) =>
    http.patch<{ data: SmsSettings }>('/services/sms-settings', data).then(r => r.data.data),

  getDocTemplates: () =>
    http.get<{ data: DocumentTemplate[] }>('/services/doc-templates').then(r => r.data.data),

  createDocTemplate: (data: { name: string; type?: string; content: string; isDefault?: boolean; categoryId?: string | null }) =>
    http.post<{ data: DocumentTemplate }>('/services/doc-templates', data).then(r => r.data.data),

  updateDocTemplate: (id: string, data: { name?: string; content?: string; isDefault?: boolean; categoryId?: string | null }) =>
    http.patch<{ data: DocumentTemplate }>(`/services/doc-templates/${id}`, data).then(r => r.data.data),

  deleteDocTemplate: (id: string) =>
    http.delete(`/services/doc-templates/${id}`),
};
