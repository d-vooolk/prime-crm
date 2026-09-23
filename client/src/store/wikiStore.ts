import { create } from 'zustand';
import { wikiApi } from '@/api/wiki.api';

/** Счётчик правок вики на проверке — для бейджа в меню. Обновляется опросом и после проверки правки. */
interface WikiState {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
}

export const useWikiStore = create<WikiState>()((set) => ({
  pendingCount: 0,
  refreshPendingCount: async () => {
    try {
      set({ pendingCount: await wikiApi.getPendingCount() });
    } catch { /* бейдж не критичен */ }
  },
}));

export const WIKI_REVIEWER_ROLES = ['Создатель', 'Директор', 'Менеджер'];

export function isWikiReviewer(user: { isMaster: boolean; role?: string } | null) {
  return !!user && (user.isMaster || WIKI_REVIEWER_ROLES.includes(user.role || ''));
}
