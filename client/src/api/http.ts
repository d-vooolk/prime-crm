import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('prime-crm-auth');
    if (raw) {
      const { state } = JSON.parse(raw);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
  } catch { /* ignore */ }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('prime-crm-auth');
      window.location.href = '/login';
    }
    // 413 отдаёт nginx (HTML, без message), обрыв связи — вообще без ответа
    const message = err.response?.data?.message
      || (err.response?.status === 413 ? 'Файл слишком большой' : null)
      || (!err.response ? 'Нет связи с сервером' : null)
      || 'Ошибка сервера';
    return Promise.reject(new Error(message));
  }
);

export default http;
