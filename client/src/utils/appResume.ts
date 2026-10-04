/**
 * Чистая логика автообновления при возврате в приложение (см. hooks/useAppResume.ts).
 */

/** Сколько приложение должно пробыть в фоне, чтобы при возврате перечитать данные */
export const RESUME_MIN_HIDDEN_MS = 30 * 1000;

/** Пора ли обновлять данные: приложение было скрыто достаточно долго */
export function isLongEnoughHidden(hiddenAt: number | null, now: number, minMs = RESUME_MIN_HIDDEN_MS): boolean {
  return hiddenAt !== null && now - hiddenAt >= minMs;
}

/**
 * Выбранная дата расписания после смены суток. Если был открыт «сегодняшний» день,
 * переходим на новый сегодняшний; если пользователь сам выбрал другую дату — не трогаем.
 * Даты — YYYY-MM-DD.
 */
export function followToday(selectedDate: string, prevToday: string, today: string): string {
  return prevToday !== today && selectedDate === prevToday ? today : selectedDate;
}
