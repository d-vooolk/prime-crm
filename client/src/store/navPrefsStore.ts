import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavPrefsState {
  /** Выбранные разделы нижней панели телефона: свой набор у каждого пользователя на этом устройстве */
  bottomNav: Record<string, string[]>;
  setBottomNav: (userId: string, paths: string[] | null) => void;
}

export const useNavPrefsStore = create<NavPrefsState>()(
  persist(
    (set) => ({
      bottomNav: {},
      // null — вернуть набор по умолчанию
      setBottomNav: (userId, paths) => set((s) => {
        const next = { ...s.bottomNav };
        if (paths) next[userId] = paths;
        else delete next[userId];
        return { bottomNav: next };
      }),
    }),
    { name: 'prime-crm-nav' },
  ),
);
