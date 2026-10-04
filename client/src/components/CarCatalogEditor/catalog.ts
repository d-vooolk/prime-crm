import { CarBrand, CarGeneration, CarModel } from '@/types';

export type Level = 'mark' | 'model' | 'generation';
export type AnyItem = CarBrand | CarModel | CarGeneration;

export const LEVEL_LABELS: Record<Level, { one: string; add: string; empty: string }> = {
  mark: { one: 'марку', add: 'Добавить марку', empty: 'Марок нет' },
  model: { one: 'модель', add: 'Добавить модель', empty: 'Выберите марку слева' },
  generation: { one: 'поколение', add: 'Добавить поколение', empty: 'Выберите модель слева' },
};

/** Годы выпуска для списка: «2010–2015», «2018–н.в.»; без годов — null */
export function yearsLabel(item: Pick<AnyItem, 'year_from' | 'year_to'>): string | null {
  if (!item.year_from && !item.year_to) return null;
  return `${item.year_from ?? '...'}–${item.year_to ?? 'н.в.'}`;
}

/** Ссылка на фото поколения: в каталоге донора она хранится без протокола */
export const photoUrl = (photo: string) => (photo.startsWith('http') ? photo : `https://${photo}`);
