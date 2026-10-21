import http from './http';
import {
  VdfCatalogCategory, VdfCatalogList, WikiEntry, WikiEntrySummary, WikiKey, WikiMedia, WikiRevision, WikiSection, WikiSettings,
} from '@/types';

export const wikiApi = {
  getEntries: () =>
    http.get<{ data: WikiEntrySummary[] }>('/wiki/entries').then(r => r.data.data),

  getEntry: (key: WikiKey) =>
    http.get<{ data: WikiEntry | null }>('/wiki/entry', { params: key }).then(r => r.data.data),

  /** sectionId: null — «Общее» */
  saveContent: (key: WikiKey, sectionId: string | null, content: string) =>
    http.put<{ data: WikiEntry }>('/wiki/entry', { ...key, sectionId, content }).then(r => r.data.data),

  uploadMedia: (key: WikiKey, sectionId: string | null, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    // Поля ключа — до файла: так multer разберёт их раньше, чем начнёт писать файл
    form.append('markId', key.markId);
    form.append('modelId', key.modelId);
    form.append('generationId', key.generationId);
    if (sectionId) form.append('sectionId', sectionId);
    form.append('file', file);
    return http.post<{ data: WikiMedia }>('/wiki/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress: e => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then(r => r.data.data);
  },

  deleteMedia: (id: string) =>
    http.delete(`/wiki/media/${id}`),

  getCatalogCategories: () =>
    http.get<{ data: { categories: VdfCatalogCategory[] } }>('/wiki/catalog').then(r => r.data.data.categories),

  searchCatalog: (q: string) =>
    http.get<{ data: VdfCatalogList }>('/wiki/catalog', { params: { q } }).then(r => r.data.data),

  getCatalogCategory: (category: string) =>
    http.get<{ data: VdfCatalogList }>('/wiki/catalog', { params: { category } }).then(r => r.data.data),

  /** sectionId: null — «Общее» */
  addProduct: (key: WikiKey, sectionId: string | null, productId: string) =>
    http.post<{ data: WikiEntry }>('/wiki/products', { ...key, sectionId, productId }).then(r => r.data.data),

  removeProduct: (id: string) =>
    http.delete(`/wiki/products/${id}`),

  getRevisions: (status: 'PENDING' | 'DONE') =>
    http.get<{ data: WikiRevision[] }>('/wiki/revisions', { params: { status } }).then(r => r.data.data),

  getPendingCount: () =>
    http.get<{ data: { count: number } }>('/wiki/revisions/pending-count').then(r => r.data.data.count),

  markReviewed: (id: string) =>
    http.post(`/wiki/revisions/${id}/review`),

  /** amount — сумма премии, если отличается от настроек (частичная оплата) */
  reward: (id: string, amount?: number) =>
    http.post(`/wiki/revisions/${id}/reward`, amount === undefined ? {} : { amount }),

  getSections: () =>
    http.get<{ data: WikiSection[] }>('/wiki/sections').then(r => r.data.data),

  createSection: (data: Pick<WikiSection, 'name' | 'serviceIds'>) =>
    http.post<{ data: WikiSection[] }>('/wiki/sections', data).then(r => r.data.data),

  updateSection: (id: string, data: Partial<Pick<WikiSection, 'name' | 'serviceIds'>>) =>
    http.patch<{ data: WikiSection[] }>(`/wiki/sections/${id}`, data).then(r => r.data.data),

  deleteSection: (id: string) =>
    http.delete<{ data: WikiSection[] }>(`/wiki/sections/${id}`).then(r => r.data.data),

  getSettings: () =>
    http.get<{ data: WikiSettings }>('/wiki/settings').then(r => r.data.data),

  updateSettings: (data: Pick<WikiSettings, 'bonusAmount'>) =>
    http.patch<{ data: WikiSettings }>('/wiki/settings', data).then(r => r.data.data),
};
