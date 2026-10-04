import { useEffect, useState } from 'react';
import { carsApi } from '@/api/cars.api';
import { CarGeneration, CarModel } from '@/types';
import { useNotify } from '@/hooks/useNotify';

/**
 * Модели выбранной марки и поколения выбранной модели. Грузятся по выбранным id,
 * прошлый запрос отменяется — при быстрой смене марки ответ по старой не перезапишет список.
 */
export function useCarCatalog(brandId: string, modelId: string) {
  const notify = useNotify();
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  useEffect(() => {
    setModels([]);
    setLoadingModels(!!brandId);
    if (!brandId) return;
    const controller = new AbortController();
    carsApi.getModels(brandId, controller.signal)
      .then(setModels)
      .catch(e => notify.error(e, 'Не удалось загрузить модели'))
      .finally(() => { if (!controller.signal.aborted) setLoadingModels(false); });
    return () => controller.abort();
  }, [brandId, notify]);

  useEffect(() => {
    setGenerations([]);
    setLoadingGenerations(!!brandId && !!modelId);
    if (!brandId || !modelId) return;
    const controller = new AbortController();
    carsApi.getGenerations(brandId, modelId, controller.signal)
      .then(setGenerations)
      .catch(e => notify.error(e, 'Не удалось загрузить поколения'))
      .finally(() => { if (!controller.signal.aborted) setLoadingGenerations(false); });
    return () => controller.abort();
  }, [brandId, modelId, notify]);

  return { models, generations, loadingModels, loadingGenerations };
}
