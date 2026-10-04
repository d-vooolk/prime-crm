import http from './http';
import type { AuthUser } from '@/types';

interface LoginResponse {
  data: { token: string; user: AuthUser };
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }).then(r => r.data.data),

  me: (signal?: AbortSignal) =>
    http.get<{ data: AuthUser }>('/auth/me', { signal }).then(r => r.data.data),
};
