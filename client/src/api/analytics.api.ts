import http from './http';
import { SourceStats } from '@/types';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const analyticsApi = {
  getSummary: (period: Period) =>
    http.get('/services/analytics/summary', { params: { period } }).then(r => r.data.data),

  getRevenue: (from: string, to: string) =>
    http.get('/services/analytics/revenue', { params: { from, to } }).then(r => r.data.data),

  getTopServices: (period: Period) =>
    http.get('/services/analytics/top-services', { params: { period } }).then(r => r.data.data),

  /** Каналы привлечения за период; from/to — YYYY-MM-DD включительно */
  getSources: (from: string, to: string) =>
    http.get<{ data: SourceStats }>('/services/analytics/sources', { params: { from, to } }).then(r => r.data.data),
};
