import { useEffect, useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';
import type { ClientsFilter } from '@/api/clients.api';
import { DAY_FORMAT, phoneDigits } from './clientsHelpers';

// Пауза после ввода, прежде чем идти на сервер
const DEBOUNCE_MS = 350;
// Меньше цифр телефона искать бессмысленно — совпадёт почти вся база
const PHONE_MIN_DIGITS = 2;

/** Значение, которое «догоняет» исходное после паузы во вводе. */
export function useDebounced<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Состояние фильтров списка клиентов и собранный из него запрос к серверу */
export function useClientsFilter() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [brandId, setBrandIdRaw] = useState<string | undefined>();
  const [modelId, setModelIdRaw] = useState<string | undefined>();
  const [generationId, setGenerationId] = useState<string | undefined>();
  // Услуга и период: клиенты, которым делали услугу в эти даты
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [period, setPeriod] = useState<[Dayjs, Dayjs] | null>(null);

  const debouncedName = useDebounced(name.trim());
  const debouncedPlate = useDebounced(plate.trim());
  const debouncedPhone = useDebounced(phoneDigits(phone));

  // Смена марки сбрасывает модель и поколение, смена модели — поколение
  const setBrandId = (value?: string) => {
    setBrandIdRaw(value);
    setModelIdRaw(undefined);
    setGenerationId(undefined);
  };

  const setModelId = (value?: string) => {
    setModelIdRaw(value);
    setGenerationId(undefined);
  };

  const reset = () => {
    setPhone('');
    setName('');
    setPlate('');
    setBrandId(undefined);
    setServiceId(undefined);
    setPeriod(null);
  };

  const filter = useMemo<ClientsFilter>(() => ({
    name: debouncedName || undefined,
    phone: debouncedPhone.length >= PHONE_MIN_DIGITS ? debouncedPhone : undefined,
    plate: debouncedPlate || undefined,
    brandId,
    modelId,
    generationId,
    serviceId,
    from: period?.[0].format(DAY_FORMAT),
    to: period?.[1].format(DAY_FORMAT),
  }), [debouncedName, debouncedPhone, debouncedPlate, brandId, modelId, generationId, serviceId, period]);

  const recordFilterActive = !!serviceId || !!period;
  const carFiltersCount = [brandId, modelId, generationId, plate.trim(), serviceId, period].filter(Boolean).length;
  const hasFilters = carFiltersCount > 0 || !!name.trim() || phoneDigits(phone).length > 0;

  return {
    phone, setPhone, name, setName, plate, setPlate,
    brandId, setBrandId, modelId, setModelId, generationId, setGenerationId,
    serviceId, setServiceId, period, setPeriod,
    debouncedName, filter, reset,
    recordFilterActive, carFiltersCount, hasFilters,
  };
}

export type ClientsFilterState = ReturnType<typeof useClientsFilter>;
