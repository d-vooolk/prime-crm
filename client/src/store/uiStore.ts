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
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        document.documentElement.setAttribute('data-theme', next);
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
