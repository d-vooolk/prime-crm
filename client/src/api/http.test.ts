import { beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter } from 'axios';
import http from './http';
import { useAuthStore } from '@/store/authStore';

// Подменяем транспорт: сервер «отвечает» заданным статусом и сообщением
const respond = (status: number, message?: string): AxiosAdapter => (config) =>
  Promise.reject(Object.assign(new Error('Request failed'), {
    config,
    isAxiosError: true,
    response: { status, data: message ? { message } : {}, headers: {}, config, statusText: '' },
  }));

const user = { id: '1', name: 'Иван', email: 'i@x.by', role: 'Менеджер', isMaster: false };

describe('перехватчик ответов http', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'tok', user, logoutReason: null });
  });

  it('401 при входе — не разлогинивает, сообщение уходит в форму', async () => {
    await expect(http.post('/auth/login', {}, { adapter: respond(401, 'Неверный email или пароль') }))
      .rejects.toThrow('Неверный email или пароль');
    expect(useAuthStore.getState().token).toBe('tok');
  });

  it('401 на прочих запросах — выход через стор с причиной', async () => {
    await expect(http.get('/records', { adapter: respond(401, 'Сессия истекла') })).rejects.toThrow('Сессия истекла');
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.logoutReason).toBe('Сессия истекла');
  });

  it('403 — только ошибка, без выхода', async () => {
    await expect(http.get('/accounting', { adapter: respond(403) })).rejects.toThrow('Недостаточно прав');
    expect(useAuthStore.getState().token).toBe('tok');
  });

  it('429 — сообщение сервера о блокировке', async () => {
    await expect(http.post('/auth/login', {}, { adapter: respond(429, 'Слишком много попыток. Попробуйте через 15 минут') }))
      .rejects.toThrow('Слишком много попыток');
    expect(useAuthStore.getState().token).toBe('tok');
  });

  it('подставляет токен из стора в заголовок', async () => {
    let auth: unknown;
    await http.get('/x', {
      adapter: async (config) => {
        auth = config.headers.Authorization;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    expect(auth).toBe('Bearer tok');
  });
});
