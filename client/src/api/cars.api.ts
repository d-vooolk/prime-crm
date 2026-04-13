import { CarBrand, CarModel, CarGeneration } from '@/types';

const BASE_URL = 'https://auto-data.api-home.ru/api/public/v1';
const TOKEN = 'j8zmlGcAdsNnRn5pzDY3ZMfzDQGqSsE8lUpmv9Tej1GKoVq0cFW2ctD82NA7bmuT';
const HEADERS = { 'api-token': TOKEN };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('Ошибка загрузки данных об автомобиле');
  const data = await res.json();
  return (Array.isArray(data) ? data : data.data || []) as T;
}

export const carsApi = {
  getBrands: () => fetchJson<CarBrand[]>(`${BASE_URL}/marks`),
  getModels: (brandId: string) => fetchJson<CarModel[]>(`${BASE_URL}/marks/${brandId}/models`),
  getGenerations: (brandId: string, modelId: string) =>
    fetchJson<CarGeneration[]>(`${BASE_URL}/marks/${brandId}/models/${modelId}/generations`),
};
