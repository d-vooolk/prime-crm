import http from './http';
import { Category, Equipment, Serviceman, CompanySettings } from '@/types';

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

  createEquipment: (name: string) =>
    http.post<{ data: Equipment }>('/services/equipment', { name }).then(r => r.data.data),

  updateEquipment: (id: string, name: string) =>
    http.patch<{ data: Equipment }>(`/services/equipment/${id}`, { name }).then(r => r.data.data),

  deleteEquipment: (id: string) =>
    http.delete(`/services/equipment/${id}`),

  getServicemen: () =>
    http.get<{ data: Serviceman[] }>('/services/servicemen').then(r => r.data.data),

  createServiceman: (name: string) =>
    http.post<{ data: Serviceman }>('/services/servicemen', { name }).then(r => r.data.data),

  deleteServiceman: (id: string) =>
    http.delete(`/services/servicemen/${id}`),

  getSettings: () =>
    http.get<{ data: CompanySettings }>('/services/settings').then(r => r.data.data),

  updateSettings: (data: Partial<CompanySettings>) =>
    http.patch<{ data: CompanySettings }>('/services/settings', data).then(r => r.data.data),
};
