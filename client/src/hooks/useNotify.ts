import { App } from 'antd';

export function useNotify() {
  const { notification } = App.useApp();

  return {
    success: (title: string, description?: string) =>
      notification.success({ message: title, description, placement: 'topRight', duration: 4 }),

    error: (title: string, description?: string) =>
      notification.error({ message: title, description, placement: 'topRight', duration: 6 }),

    warning: (title: string, description?: string) =>
      notification.warning({ message: title, description, placement: 'topRight', duration: 5 }),

    info: (title: string, description?: string) =>
      notification.info({ message: title, description, placement: 'topRight', duration: 4 }),
  };
}
