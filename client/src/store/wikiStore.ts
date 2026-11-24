import { create } from 'zustand';
import { wikiApi } from '@/api/wiki.api';

/**
 * Бейдж вики в меню: у проверяющих — правки на проверке, у сотрудников — возвращённые им на доработку.
 * Обновляется опросом, после проверки правки и после повторной отправки.
 */
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

// Проверка прав живёт в utils/roles.ts; реэкспорт — чтобы не менять импорты вики
export { WIKI_REVIEWER_ROLES, isWikiReviewer } from '@/utils/roles';
