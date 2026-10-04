import type { ClientSource } from '@/types';

/** Источники клиента в том порядке, в каком их показываем в выпадающем списке */
export const CLIENT_SOURCES: ClientSource[] = ['INSTAGRAM', 'RECOMMENDATION', 'SEARCH', 'MAPS', 'OTHER'];

export const CLIENT_SOURCE_LABELS: Record<ClientSource | 'NONE', string> = {
  INSTAGRAM: 'Instagram',
  RECOMMENDATION: 'Рекомендация',
  SEARCH: 'Поиск',
  MAPS: 'Карты',
  OTHER: 'Другое',
  NONE: 'Не указан',
};

export const CLIENT_SOURCE_OPTIONS = CLIENT_SOURCES.map(value => ({ value, label: CLIENT_SOURCE_LABELS[value] }));

export const clientSourceLabel = (source?: ClientSource | 'NONE' | null) => CLIENT_SOURCE_LABELS[source ?? 'NONE'];
