import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWikiStore } from '@/store/wikiStore';

const POLL_INTERVAL = 2 * 60 * 1000;

/**
 * Периодически обновляет бейдж вики в меню: проверяющим — правки на проверке,
 * сотрудникам — свои правки, возвращённые на доработку.
 */
export function useWikiPendingCount() {
  const userId = useAuthStore(s => s.user?.id);
  const refresh = useWikiStore(s => s.refreshPendingCount);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [userId, refresh]);
}
