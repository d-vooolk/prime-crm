import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Эндпоинты входа: их 401 — это «неверный пароль», а не истёкшая сессия
const LOGIN_ENDPOINTS = ['/auth/login'];

const isLoginRequest = (url?: string) => !!url && LOGIN_ENDPOINTS.some(p => url.startsWith(p));

http.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // Отменённый запрос пробрасываем как есть — вызывающий код отличает его через isAbortError
    if (axios.isCancel(err)) return Promise.reject(err);

    const status: number | undefined = err.response?.status;
    // 413 отдаёт nginx (HTML, без message), обрыв связи — вообще без ответа
    const message = err.response?.data?.message
      || (status === 413 ? 'Файл слишком большой' : null)
      || (status === 403 ? 'Недостаточно прав' : null)
      || (status === 429 ? 'Слишком много запросов, попробуйте позже' : null)
      || (!err.response ? 'Нет связи с сервером' : null)
      || 'Ошибка сервера';

    // Сессия истекла или токен отозван: выходим через стор, PrivateRoute сам уведёт на /login
    // без перезагрузки страницы. 403 и 429 — не повод разлогинивать.
    if (status === 401 && !isLoginRequest(err.config?.url)) {
      const { token, logout } = useAuthStore.getState();
      if (token) logout(message);
    }
    return Promise.reject(new Error(message));
  }
);

export default http;
