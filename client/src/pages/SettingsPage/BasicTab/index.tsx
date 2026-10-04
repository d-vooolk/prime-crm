import React from 'react';
import { Button, Card, Popconfirm, Switch } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { AppDeviceSettings } from '@/components/AppDeviceSettings';
import styles from './BasicTab.module.scss';

/** Тема, приложение на телефоне, уведомления и выход — доступно всем, включая сотрудников */
export const BasicTab: React.FC = () => {
  const { theme, toggleTheme } = useUiStore();
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Card>
      <div className={styles.row}>
        <div>
          <div className={styles.label}>Тёмная тема</div>
          <div className={styles.hint}>Переключить между светлой и тёмной темой</div>
        </div>
        <Switch checked={theme === 'dark'} onChange={toggleTheme} />
      </div>
      <AppDeviceSettings />
      <div className={styles.footer}>
        <Popconfirm title="Выйти из системы?" onConfirm={handleLogout} okText="Выйти" cancelText="Отмена">
          <Button danger icon={<LogoutOutlined />}>Выйти из системы</Button>
        </Popconfirm>
      </div>
    </Card>
  );
};
