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
      theme: 'light',
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
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
