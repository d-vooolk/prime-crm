import dayjs, { Dayjs } from 'dayjs';
import type { Car, Client } from '@/types';

export const DAY_FORMAT = 'YYYY-MM-DD';

/**
 * Цифры номера после кода страны. Маска всегда подставляет «+375»,
 * поэтому код отрезаем — иначе он совпадал бы с любым номером.
 */
export function phoneDigits(masked: string): string {
  return masked.replace(/^\s*\+?375/, '').replace(/\D/g, '');
}

export const carLabel = (car: Pick<Car, 'brand' | 'model' | 'year'>) =>
  [car.brand, car.model, car.year].filter(Boolean).join(' ');

export const yearsLabel = (from?: number | null, to?: number | null) =>
  from ? ` (${from}–${to ?? 'н.в.'})` : '';

/** Машины из подошедших записей — без повторов, в порядке от свежей записи */
export const matchedCars = (client: Pick<Client, 'matchedRecords'>): Car[] => {
  const cars = new Map<string, Car>();
  for (const r of client.matchedRecords ?? []) {
    if (!cars.has(r.car.id)) cars.set(r.car.id, r.car);
  }
  return [...cars.values()];
};

/** Номер для ссылки tel: — только цифры и плюс */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const getPeriodPresets = (now: Dayjs = dayjs()): Array<{ label: string; value: [Dayjs, Dayjs] }> => [
  { label: 'Этот месяц', value: [now.startOf('month'), now.endOf('month')] },
  { label: 'Прошлый месяц', value: [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')] },
  { label: '3 месяца', value: [now.subtract(3, 'month'), now] },
  { label: 'Полгода', value: [now.subtract(6, 'month'), now] },
  { label: 'Этот год', value: [now.startOf('year'), now.endOf('year')] },
  { label: 'Год', value: [now.subtract(1, 'year'), now] },
];
