import { CarBrand, CarModel, CarGeneration } from '@/types';
import http from './http';

/**
 * Справочник авто отдаёт наш сервер из собственной БД.
 * Раньше запросы шли напрямую в сторонний каталог auto-data.api-home.ru —
 * он регулярно висел по 15+ секунд и терял до трети запросов.
 * Данные выкачаны к себе: server/scripts/fetch-cars.ts + npm run cars:seed.
 *
 * Записи бывают двух видов: SNAPSHOT — из каталога донора, только чтение;
 * MANUAL — заведённые руками (грузовые и прочее, чего у донора нет).
 */

export type CatalogSource = 'SNAPSHOT' | 'MANUAL';

export interface CatalogItemInput {
  name: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  /** Только для поколений: полная ссылка на изображение. */
  photo?: string | null;
}

const marksUrl = (markId: string) => `/cars/marks/${encodeURIComponent(markId)}`;
const modelsUrl = (markId: string, modelId: string) => `${marksUrl(markId)}/models/${encodeURIComponent(modelId)}`;

export const carsApi = {
  getBrands: (manualOnly = false) =>
    http.get<{ data: CarBrand[] }>('/cars/marks', { params: manualOnly ? { manualOnly: true } : undefined })
      .then(r => r.data.data),

  getModels: (brandId: string) =>
    http.get<{ data: CarModel[] }>(`${marksUrl(brandId)}/models`).then(r => r.data.data),

  getGenerations: (brandId: string, modelId: string) =>
    http.get<{ data: CarGeneration[] }>(`${modelsUrl(brandId, modelId)}/generations`).then(r => r.data.data),

  // --- Ручные записи ---

  createMark: (data: CatalogItemInput) =>
    http.post('/cars/marks', data).then(r => r.data.data),
  updateMark: (markId: string, data: Partial<CatalogItemInput>) =>
    http.patch(marksUrl(markId), data).then(r => r.data.data),
  deleteMark: (markId: string) =>
    http.delete(marksUrl(markId)),

  createModel: (markId: string, data: CatalogItemInput) =>
    http.post(`${marksUrl(markId)}/models`, data).then(r => r.data.data),
  updateModel: (markId: string, modelId: string, data: Partial<CatalogItemInput>) =>
    http.patch(modelsUrl(markId, modelId), data).then(r => r.data.data),
  deleteModel: (markId: string, modelId: string) =>
    http.delete(modelsUrl(markId, modelId)),

  createGeneration: (markId: string, modelId: string, data: CatalogItemInput) =>
    http.post(`${modelsUrl(markId, modelId)}/generations`, data).then(r => r.data.data),
  updateGeneration: (markId: string, modelId: string, generationId: string, data: Partial<CatalogItemInput>) =>
    http.patch(`${modelsUrl(markId, modelId)}/generations/${encodeURIComponent(generationId)}`, data).then(r => r.data.data),
  deleteGeneration: (markId: string, modelId: string, generationId: string) =>
    http.delete(`${modelsUrl(markId, modelId)}/generations/${encodeURIComponent(generationId)}`),
};
