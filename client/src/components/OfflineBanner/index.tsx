import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import styles from './OfflineBanner.module.scss';

/** Нет сети: приложение работает из кеша и показывает последние сохранённые данные */
export const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <Alert
      banner
      type="warning"
      className={styles.banner}
      message="Нет связи с интернетом — показаны последние сохранённые данные, изменения сейчас не сохранятся"
    />
  );
};
