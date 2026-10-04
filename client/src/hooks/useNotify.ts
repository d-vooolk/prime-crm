import { useMemo } from 'react';
import { App } from 'antd';
import { getErrorMessage, isAbortError } from '@/utils/errors';

/**
 * Единый способ сообщать пользователю о результате действий.
 * - toast.success/... — короткое подтверждение («Сохранено»), antd message из контекста App
 * - error(e, title) — ошибка запроса: заголовок + текст от сервера; отменённые запросы молча пропускаются
 * - success/warning/info — развёрнутые уведомления с описанием
 * Объект мемоизирован — его можно класть в зависимости хуков.
 */
export function useNotify() {
  const { notification, message } = App.useApp();

  return useMemo(() => ({
    toast: message,

    success: (title: string, description?: string) =>
      notification.success({ message: title, description, placement: 'topRight', duration: 4 }),

    error: (e: unknown, title = 'Ошибка') => {
      if (isAbortError(e)) return;
      notification.error({ message: title, description: getErrorMessage(e), placement: 'topRight', duration: 6 });
    },

    warning: (title: string, description?: string) =>
      notification.warning({ message: title, description, placement: 'topRight', duration: 5 }),

    info: (title: string, description?: string) =>
      notification.info({ message: title, description, placement: 'topRight', duration: 4 }),
  }), [notification, message]);
}
