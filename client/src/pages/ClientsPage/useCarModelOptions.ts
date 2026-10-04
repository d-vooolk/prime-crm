import { useEffect, useState } from 'react';
import { carsApi } from '@/api/cars.api';
import type { CarGeneration, CarModel } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { isAbortError } from '@/utils/errors';

/**
 * Модели выбранной марки и поколения выбранной модели для фильтра.
 * Предыдущий запрос отменяется: при быстрой смене марки поздний ответ не подменит список.
 */
export function useCarModelOptions(brandId?: string, modelId?: string) {
  const notify = useNotify();
  const [models, setModels] = useState<CarModel[]>([]);
  const [generations, setGenerations] = useState<CarGeneration[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  useEffect(() => {
    setModels([]);
    if (!brandId) { setLoadingModels(false); return; }
    const controller = new AbortController();
    setLoadingModels(true);
    carsApi.getModels(brandId, controller.signal)
      .then(setModels)
      .catch(e => { if (!isAbortError(e)) notify.error(e, 'Не удалось загрузить модели'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingModels(false); });
    return () => controller.abort();
  }, [brandId, notify]);

  useEffect(() => {
    setGenerations([]);
    if (!brandId || !modelId) { setLoadingGenerations(false); return; }
    const controller = new AbortController();
    setLoadingGenerations(true);
    carsApi.getGenerations(brandId, modelId, controller.signal)
      .then(setGenerations)
      .catch(e => { if (!isAbortError(e)) notify.error(e, 'Не удалось загрузить поколения'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingGenerations(false); });
    return () => controller.abort();
  }, [brandId, modelId, notify]);

  return { models, generations, loadingModels, loadingGenerations };
}
