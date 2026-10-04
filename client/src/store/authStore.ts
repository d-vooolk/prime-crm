import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** Почему разлогинили (истекла сессия и т.п.) — показывается на странице входа, не сохраняется */
  logoutReason: string | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  /** Обновить данные пользователя (роль/имя могли поменяться на сервере) */
  setUser: (user: AuthUser) => void;
  logout: (reason?: string) => void;
  clearLogoutReason: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      logoutReason: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user, logoutReason: null }),
      setUser: (user) => set({ user }),
      logout: (reason) => {
        set({ token: null, user: null, logoutReason: reason ?? null });
        // PWA убирает с устройства пуш-подписку и кеш данных прошлого пользователя (pwa/index.ts)
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('prime-crm:logout'));
      },
      clearLogoutReason: () => set({ logoutReason: null }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'prime-crm-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
