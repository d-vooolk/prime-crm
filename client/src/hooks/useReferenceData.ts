import { useCallback } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/api/services.api';
import { carsApi } from '@/api/cars.api';
import { expensesApi } from '@/api/expenses.api';

/** Ключи справочников — инвалидировать после изменений через useInvalidateReference */
export const referenceKeys = {
  servicemen: ['servicemen', 'active'] as const,
  allServicemen: ['servicemen', 'all'] as const,
  serviceCategories: ['serviceCategories'] as const,
  companySettings: ['companySettings'] as const,
  docTemplates: ['docTemplates'] as const,
  carBrands: ['carBrands'] as const,
  equipment: ['equipment'] as const,
  expenseCategories: ['expenseCategories'] as const,
  clientSources: ['clientSources'] as const,
};

export type ReferenceKey = keyof typeof referenceKeys;

const MIN = 60 * 1000;

/**
 * Опции запросов справочников: используются и хуками ниже, и там, где данные нужны
 * разово вне рендера (queryClient.fetchQuery при печати) — с тем же ключом и staleTime.
 */
export const referenceQueries = {
  servicemen: queryOptions({
    queryKey: referenceKeys.servicemen,
    queryFn: servicesApi.getServicemen,
    meta: { errorTitle: 'Не удалось загрузить сотрудников' },
  }),
  allServicemen: queryOptions({
    queryKey: referenceKeys.allServicemen,
    queryFn: servicesApi.getAllServicemen,
    meta: { errorTitle: 'Не удалось загрузить сотрудников' },
  }),
  serviceCategories: queryOptions({
    queryKey: referenceKeys.serviceCategories,
    queryFn: servicesApi.getCategories,
    meta: { errorTitle: 'Не удалось загрузить услуги' },
  }),
  companySettings: queryOptions({
    queryKey: referenceKeys.companySettings,
    queryFn: servicesApi.getSettings,
    staleTime: 10 * MIN,
    meta: { errorTitle: 'Не удалось загрузить настройки компании' },
  }),
  docTemplates: queryOptions({
    queryKey: referenceKeys.docTemplates,
    queryFn: servicesApi.getDocTemplates,
    staleTime: 10 * MIN,
    meta: { errorTitle: 'Не удалось загрузить шаблоны документов' },
  }),
  // Марки авто: справочник почти статичный
  carBrands: queryOptions({
    queryKey: referenceKeys.carBrands,
    queryFn: () => carsApi.getBrands(),
    staleTime: 30 * MIN,
    meta: { errorTitle: 'Не удалось загрузить марки авто' },
  }),
  equipment: queryOptions({
    queryKey: referenceKeys.equipment,
    queryFn: servicesApi.getEquipment,
    meta: { errorTitle: 'Не удалось загрузить оборудование' },
  }),
  expenseCategories: queryOptions({
    queryKey: referenceKeys.expenseCategories,
    queryFn: expensesApi.getCategories,
    meta: { errorTitle: 'Не удалось загрузить категории расходов' },
  }),
  clientSources: queryOptions({
    queryKey: referenceKeys.clientSources,
    queryFn: servicesApi.getClientSources,
    meta: { errorTitle: 'Не удалось загрузить источники клиентов' },
  }),
};

/** enabled: false — не запрашивать (например, список нужен только определённой роли) */
interface RefOptions {
  enabled?: boolean;
}

/** Активные сотрудники (без уволенных) */
export const useServicemen = (o?: RefOptions) => useQuery({ ...referenceQueries.servicemen, ...o });

/** Все сотрудники, включая уволенных */
export const useAllServicemen = (o?: RefOptions) => useQuery({ ...referenceQueries.allServicemen, ...o });

/** Категории услуг вместе с услугами */
export const useServiceCategories = (o?: RefOptions) => useQuery({ ...referenceQueries.serviceCategories, ...o });

export const useCompanySettings = (o?: RefOptions) => useQuery({ ...referenceQueries.companySettings, ...o });

export const useDocTemplates = (o?: RefOptions) => useQuery({ ...referenceQueries.docTemplates, ...o });

export const useCarBrands = (o?: RefOptions) => useQuery({ ...referenceQueries.carBrands, ...o });

export const useEquipment = (o?: RefOptions) => useQuery({ ...referenceQueries.equipment, ...o });

export const useExpenseCategories = (o?: RefOptions) => useQuery({ ...referenceQueries.expenseCategories, ...o });

/** Источники клиента (без скрытых) */
export const useClientSources = (o?: RefOptions) => useQuery({ ...referenceQueries.clientSources, ...o });

/**
 * Сбросить кеш справочников после изменения. Сотрудники инвалидируются оба списка сразу
 * (ключи с общим префиксом 'servicemen').
 */
export function useInvalidateReference() {
  const qc = useQueryClient();
  return useCallback((...keys: ReferenceKey[]) => Promise.all(keys.map(k => {
    const queryKey = k === 'servicemen' || k === 'allServicemen' ? ['servicemen'] : referenceKeys[k];
    return qc.invalidateQueries({ queryKey });
  })), [qc]);
}
