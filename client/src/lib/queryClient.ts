import { QueryClient } from '@tanstack/react-query';

/**
 * Через react-query грузятся справочники (сотрудники, категории, настройки компании и т.п.):
 * их запрашивали десятки компонентов, каждый при открытии. Теперь — один запрос на staleTime,
 * а после изменений соответствующий ключ инвалидируется.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      // Справочники меняются редко, а лишние запросы при каждом переключении вкладки браузера не нужны
      refetchOnWindowFocus: false,
    },
  },
});

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** Заголовок уведомления при ошибке загрузки (см. QueryErrorReporter) */
      errorTitle?: string;
      /** Не показывать уведомление — ошибку обрабатывает сам компонент или она не важна */
      silent?: boolean;
    };
  }
}
