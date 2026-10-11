import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';

interface UiState {
  theme: 'light' | 'dark';
  selectedDate: string; // ISO date string YYYY-MM-DD
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSelectedDate: (date: string) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Фирменный тёмный стиль (как страница записи для клиента) — по умолчанию
      theme: 'dark',
      selectedDate: dayjs().format('YYYY-MM-DD'),
      sidebarCollapsed: false,
      // Атрибут ставим до обновления стора: компоненты, читающие CSS-переменные (useCssVars),
      // при перерисовке должны уже видеть значения новой темы
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        set({ theme: next });
      },
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'prime-crm-ui',
      // v1: новое оформление — один раз включаем всем тёмную тему, светлую можно вернуть в настройках
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Pick<UiState, 'theme' | 'sidebarCollapsed'>;
        return version < 1 ? { ...state, theme: 'dark' as const } : state;
      },
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
