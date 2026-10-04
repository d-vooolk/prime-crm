import React, { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/Logo';
import { getErrorMessage } from '@/utils/errors';
import styles from './LoginPage.module.scss';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth, logoutReason, clearLogoutReason } = useAuthStore();
  const navigate = useNavigate();

  // Причина выхода (сессия истекла) показывается до первой попытки входа
  const shownError = error ?? logoutReason;

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    clearLogoutReason();
    try {
      const { token, user } = await authApi.login(values.email, values.password);
      setAuth(token, user);
      navigate('/schedule', { replace: true });
    } catch (e: unknown) {
      // Неверный пароль (401) и блокировка после неудачных попыток (429) — текст от сервера
      setError(getErrorMessage(e, 'Ошибка входа'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Logo className={styles.logoSvg} />
        </div>

        <h2 className={styles.title}>Вход в систему</h2>

        {shownError && <Alert className={styles.alert} type="error" showIcon message={shownError} />}

        <Form layout="vertical" onFinish={handleSubmit} size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input placeholder="Email" autoComplete="email" autoFocus />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password placeholder="Пароль" autoComplete="current-password" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className={styles.submit}
          >
            Войти
          </Button>
        </Form>
      </div>
    </div>
  );
};
