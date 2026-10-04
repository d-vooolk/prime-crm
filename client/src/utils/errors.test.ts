import { describe, expect, it } from 'vitest';
import { CanceledError } from 'axios';
import { getErrorMessage, isAbortError } from './errors';

describe('getErrorMessage', () => {
  it('берёт message у Error', () => {
    expect(getErrorMessage(new Error('Недостаточно прав'))).toBe('Недостаточно прав');
  });

  it('строку возвращает как есть', () => {
    expect(getErrorMessage('Файл слишком большой')).toBe('Файл слишком большой');
  });

  it('для прочего — запасной текст', () => {
    expect(getErrorMessage(null)).toBe('Неизвестная ошибка');
    expect(getErrorMessage({}, 'Ошибка входа')).toBe('Ошибка входа');
    expect(getErrorMessage(new Error(''), 'Ошибка')).toBe('Ошибка');
  });
});

describe('isAbortError', () => {
  it('отмена axios и AbortError — да', () => {
    expect(isAbortError(new CanceledError())).toBe(true);
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isAbortError(abort)).toBe(true);
  });

  it('обычная ошибка — нет', () => {
    expect(isAbortError(new Error('Ошибка сервера'))).toBe(false);
  });
});
