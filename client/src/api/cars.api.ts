import { CarBrand, CarModel, CarGeneration } from '@/types';
import http from './http';

/**
 * Справочник авто отдаёт наш сервер из собственной БД.
 * Раньше запросы шли напрямую в сторонний каталог auto-data.api-home.ru —
 * он регулярно висел по 15+ секунд и терял до трети запросов.
 * Данные выкачаны к себе: server/scripts/fetch-cars.ts + npm run cars:seed.
 */
export const carsApi = {
  getBrands: () =>
    http.get<{ data: CarBrand[] }>('/cars/marks').then(r => r.data.data),

  getModels: (brandId: string) =>
    http.get<{ data: CarModel[] }>(`/cars/marks/${encodeURIComponent(brandId)}/models`)
      .then(r => r.data.data),

  getGenerations: (brandId: string, modelId: string) =>
    http.get<{ data: CarGeneration[] }>(
      `/cars/marks/${encodeURIComponent(brandId)}/models/${encodeURIComponent(modelId)}/generations`,
    ).then(r => r.data.data),
};
