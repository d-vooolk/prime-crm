import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWikiStore, isWikiReviewer } from '@/store/wikiStore';

const POLL_INTERVAL = 2 * 60 * 1000;

/** Проверяющим периодически обновляет счётчик правок вики — бейдж в меню. */
export function useWikiPendingCount() {
  const { user } = useAuthStore();
  const refresh = useWikiStore(s => s.refreshPendingCount);
  const reviewer = isWikiReviewer(user);

  useEffect(() => {
    if (!reviewer) return;
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [reviewer, refresh]);
}
