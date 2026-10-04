import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotify } from '@/hooks/useNotify';

/**
 * Показывает уведомление, когда запрос react-query упал (после ретраев).
 * Так ошибки загрузки справочников видны всегда, а не превращаются в пустые списки,
 * и не нужно обрабатывать их в каждом компоненте. Отключается через meta.silent.
 */
export const QueryErrorReporter: React.FC = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    if (event.type !== 'updated' || event.action.type !== 'error') return;
    const meta = event.query.meta;
    if (meta?.silent) return;
    notify.error(event.action.error, meta?.errorTitle ?? 'Не удалось загрузить данные');
  }), [queryClient, notify]);

  return null;
};
