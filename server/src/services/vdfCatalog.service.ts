import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface VdfCatalogProduct {
  id: string;
  slug: string;
  title: string;
  url: string;
  image: string | null;
  price: number;
  inStock: boolean;
  category: string;
  /** Машина переходной рамки — в списке рамок одного типа */
  car?: string;
}

export interface VdfCatalogCategory {
  id: string;
  name: string;
  parentId: string | null;
  count: number;
  /** Раздел переходных рамок: товары разложены по типам рамок */
  frameTypes: boolean;
}

export interface VdfFrameType {
  type: string;
  count: number;
  marks: string[];
}

export interface VdfCatalogList {
  total: number;
  items: VdfCatalogProduct[];
}

const CATEGORIES_TTL_MS = 10 * 60_000;
let categoriesCache: { at: number; data: VdfCatalogCategory[] } | null = null;

/** Каталог магазина vdf.by через его /api/integrations/catalog/ с общим ключом */
async function request<T>(params: Record<string, string>): Promise<T> {
  if (!env.vdfUrl || !env.vdfIntegrationKey) {
    throw new AppError('Каталог vdf.by не подключён: нужны VDF_URL и VDF_INTEGRATION_KEY', 503);
  }
  const query = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${env.vdfUrl}/api/integrations/catalog/${query ? `?${query}` : ''}`, {
      headers: { 'x-integration-key': env.vdfIntegrationKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error('vdf catalog: магазин не ответил', { err });
    throw new AppError('Магазин vdf.by не ответил, попробуйте ещё раз', 502);
  }
  if (!res.ok) {
    logger.error(`vdf catalog: магазин ответил ${res.status}`);
    throw new AppError(`Магазин vdf.by ответил ошибкой ${res.status}`, 502);
  }
  return res.json() as Promise<T>;
}

export const vdfCatalogService = {
  async categories() {
    if (categoriesCache && Date.now() - categoriesCache.at < CATEGORIES_TTL_MS) return categoriesCache.data;
    const { categories } = await request<{ categories: VdfCatalogCategory[] }>({});
    categoriesCache = { at: Date.now(), data: categories };
    return categories;
  },

  search(query: string, offset = 0) {
    return request<VdfCatalogList>({ q: query, offset: String(offset) });
  },

  byCategory(categoryId: string, offset = 0) {
    return request<VdfCatalogList>({ category: categoryId, offset: String(offset) });
  },

  async frameTypes(categoryId: string) {
    const { types } = await request<{ types: VdfFrameType[] }>({ category: categoryId, types: '1' });
    return types;
  },

  byFrameType(categoryId: string, type: string) {
    return request<VdfCatalogList>({ category: categoryId, type });
  },

  async byId(productId: string) {
    const { items } = await request<{ items: VdfCatalogProduct[] }>({ ids: productId });
    return items[0] ?? null;
  },
};
