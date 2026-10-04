import axios from 'axios';

/** Текст ошибки для показа пользователю: http.ts уже кладёт сообщение сервера в Error.message. */
export function getErrorMessage(e: unknown, fallback = 'Неизвестная ошибка'): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}

/** Запрос отменён через AbortController (ушли со страницы, сменили дату) — это не ошибка. */
export function isAbortError(e: unknown): boolean {
  if (axios.isCancel(e)) return true;
  return e instanceof Error && (e.name === 'CanceledError' || e.name === 'AbortError');
}
