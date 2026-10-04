import { useEffect } from 'react';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/authStore';

/**
 * При старте приложения перечитывает текущего пользователя: роль или имя могли поменяться,
 * а в localStorage лежит копия с момента входа. 401 разлогинит перехватчик в http.ts.
 */
export function useAuthSync() {
  const token = useAuthStore(s => s.token);
  const hydrated = useAuthStore(s => s._hasHydrated);
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    if (!hydrated || !token) return;
    const controller = new AbortController();
    authApi.me(controller.signal)
      .then(user => {
        // Пока шёл запрос, могли выйти или войти под другим пользователем
        if (useAuthStore.getState().token === token) setUser(user);
      })
      .catch(() => {
        // Намеренно молча: 401 уже обработан в http.ts, а при сбое сети остаётся сохранённый пользователь
      });
    return () => controller.abort();
  }, [hydrated, token, setUser]);
}
