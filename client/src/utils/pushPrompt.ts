/**
 * Когда включать пуши самим и когда предлагать их плашкой (см. components/PushPrompt, pwa/index.ts).
 */

/** Через сколько снова показать плашку после «Не сейчас» */
export const PUSH_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PushDeviceState {
  /** Браузер умеет пуши */
  supported: boolean;
  /** Notification.permission */
  permission: NotificationPermission;
  /** Пользователь сам выключил уведомления на этом устройстве — не включаем и не предлагаем */
  optedOut: boolean;
}

/** Разрешение уже есть — подписываемся без вопросов */
export function shouldAutoEnablePush(s: PushDeviceState): boolean {
  return s.supported && s.permission === 'granted' && !s.optedOut;
}

/**
 * Предложить включить: только в установленном приложении и только если разрешения ещё не спрашивали.
 * После запрета (denied) из приложения его не вернуть — только в настройках телефона, поэтому не показываем.
 */
export function shouldShowPushPrompt(
  s: PushDeviceState & { standalone: boolean; snoozedUntil: number | null; now: number },
): boolean {
  return s.standalone && s.supported && s.permission === 'default' && !s.optedOut
    && (s.snoozedUntil === null || s.now >= s.snoozedUntil);
}
