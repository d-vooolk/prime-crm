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
    const message = err.response?.data?.message || 'Ошибка сервера';
    return Promise.reject(new Error(message));
  }
);

export default http;
