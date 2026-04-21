import http from './http';
import type { AuthUser } from '@/store/authStore';

interface LoginResponse {
  data: { token: string; user: AuthUser };
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }).then(r => r.data.data),

  me: () =>
    http.get<{ data: AuthUser }>('/auth/me').then(r => r.data.data),
};
