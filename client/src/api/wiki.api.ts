import http from './http';
import {
  WikiEntry, WikiEntrySummary, WikiKey, WikiMedia, WikiRevision, WikiSettings,
} from '@/types';

export const wikiApi = {
  getEntries: () =>
    http.get<{ data: WikiEntrySummary[] }>('/wiki/entries').then(r => r.data.data),

  getEntry: (key: WikiKey) =>
    http.get<{ data: WikiEntry | null }>('/wiki/entry', { params: key }).then(r => r.data.data),

  saveContent: (key: WikiKey, content: string) =>
    http.put<{ data: WikiEntry }>('/wiki/entry', { ...key, content }).then(r => r.data.data),

  uploadMedia: (key: WikiKey, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    // Поля ключа — до файла: так multer разберёт их раньше, чем начнёт писать файл
    form.append('markId', key.markId);
    form.append('modelId', key.modelId);
    form.append('generationId', key.generationId);
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

  getRevisions: (status: 'PENDING' | 'DONE') =>
    http.get<{ data: WikiRevision[] }>('/wiki/revisions', { params: { status } }).then(r => r.data.data),

  getPendingCount: () =>
    http.get<{ data: { count: number } }>('/wiki/revisions/pending-count').then(r => r.data.data.count),

  markReviewed: (id: string) =>
    http.post(`/wiki/revisions/${id}/review`),

  reward: (id: string) =>
    http.post(`/wiki/revisions/${id}/reward`),

  getSettings: () =>
    http.get<{ data: WikiSettings }>('/wiki/settings').then(r => r.data.data),

  updateSettings: (data: Pick<WikiSettings, 'bonusAmount'>) =>
    http.patch<{ data: WikiSettings }>('/wiki/settings', data).then(r => r.data.data),
};
