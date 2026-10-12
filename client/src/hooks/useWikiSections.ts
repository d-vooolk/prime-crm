import { useQuery } from '@tanstack/react-query';
import { wikiApi } from '@/api/wiki.api';

export const WIKI_SECTIONS_KEY = ['wiki-sections'];

/** Разделы карточки вики (Настройки → Упущенная прибыль): общий кеш для вики и настроек */
export const useWikiSections = () => useQuery({
  queryKey: WIKI_SECTIONS_KEY,
  queryFn: () => wikiApi.getSections(),
});
