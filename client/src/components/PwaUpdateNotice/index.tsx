import React, { useEffect } from 'react';
import { App, Button } from 'antd';
import { usePwaStore } from '@/store/pwaStore';
import { applyUpdate } from '@/pwa';

const KEY = 'pwa-update';

/** Вышла новая версия приложения — предлагаем перезапустить (не перезагружаем сами: можно потерять форму) */
export const PwaUpdateNotice: React.FC = () => {
  const updateReady = usePwaStore(s => s.updateReady);
  const { notification } = App.useApp();

  useEffect(() => {
    if (!updateReady) return;
    notification.info({
      key: KEY,
      message: 'Доступна новая версия',
      description: 'Сохраните открытые формы и обновите приложение.',
      duration: 0,
      placement: 'bottomRight',
      btn: <Button type="primary" size="small" onClick={() => { notification.destroy(KEY); applyUpdate(); }}>Обновить</Button>,
    });
  }, [updateReady, notification]);

  return null;
};
