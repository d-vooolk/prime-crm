import { create } from 'zustand';

/** Событие beforeinstallprompt (Chrome/Android): позволяет показать свою кнопку «Установить» */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Скачана новая версия приложения, ждёт перезапуска */
  updateReady: boolean;
  /** Можно предложить установку (Android/Chrome) */
  installPrompt: InstallPromptEvent | null;
  setUpdateReady: (v: boolean) => void;
  setInstallPrompt: (e: InstallPromptEvent | null) => void;
}

export const usePwaStore = create<PwaState>()((set) => ({
  updateReady: false,
  installPrompt: null,
  setUpdateReady: (updateReady) => set({ updateReady }),
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
}));
