import { describe, it, expect } from 'vitest';
import { isLongEnoughHidden, followToday, RESUME_MIN_HIDDEN_MS } from './appResume';

describe('isLongEnoughHidden', () => {
  it('не обновляет, если приложение не скрывалось', () => {
    expect(isLongEnoughHidden(null, 1_000_000)).toBe(false);
  });

  it('не обновляет после короткого переключения', () => {
    expect(isLongEnoughHidden(1000, 1000 + RESUME_MIN_HIDDEN_MS - 1)).toBe(false);
  });

  it('обновляет после долгого пребывания в фоне', () => {
    expect(isLongEnoughHidden(1000, 1000 + RESUME_MIN_HIDDEN_MS)).toBe(true);
  });
});

describe('followToday', () => {
  it('переходит на новый день, если был открыт сегодняшний', () => {
    expect(followToday('2026-10-03', '2026-10-03', '2026-10-04')).toBe('2026-10-04');
  });

  it('не трогает дату, выбранную вручную', () => {
    expect(followToday('2026-10-10', '2026-10-03', '2026-10-04')).toBe('2026-10-10');
  });

  it('в те же сутки ничего не меняет', () => {
    expect(followToday('2026-10-04', '2026-10-04', '2026-10-04')).toBe('2026-10-04');
  });
});
