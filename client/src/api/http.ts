import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.message || 'Ошибка сервера';
    return Promise.reject(new Error(message));
  }
);

export default http;
