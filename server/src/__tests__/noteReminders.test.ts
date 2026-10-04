import { describe, it, expect } from 'vitest';
import { isDueThisMinute, ReminderNote } from '../services/noteReminders';

const note = (n: Partial<ReminderNote>): ReminderNote => ({ id: 'n', date: new Date(2026, 9, 5), allDay: false, time: '14:30', repeat: null, ...n });

describe('напоминания заметок', () => {
  it('со временем — ровно в эту минуту указанного дня', () => {
    expect(isDueThisMinute(note({}), new Date(2026, 9, 5, 14, 30))).toBe(true);
    expect(isDueThisMinute(note({}), new Date(2026, 9, 5, 14, 31))).toBe(false);
    expect(isDueThisMinute(note({}), new Date(2026, 9, 6, 14, 30))).toBe(false);
  });

  it('на весь день — в 9:00', () => {
    expect(isDueThisMinute(note({ allDay: true, time: null }), new Date(2026, 9, 5, 9, 0))).toBe(true);
    expect(isDueThisMinute(note({ allDay: true, time: null }), new Date(2026, 9, 5, 14, 30))).toBe(false);
  });

  it('повторы: каждый день, неделю, месяц', () => {
    expect(isDueThisMinute(note({ repeat: 'DAILY' }), new Date(2026, 10, 20, 14, 30))).toBe(true);
    // 05.10.2026 — понедельник, 12.10 — тоже
    expect(isDueThisMinute(note({ repeat: 'WEEKLY' }), new Date(2026, 9, 12, 14, 30))).toBe(true);
    expect(isDueThisMinute(note({ repeat: 'WEEKLY' }), new Date(2026, 9, 13, 14, 30))).toBe(false);
    expect(isDueThisMinute(note({ repeat: 'MONTHLY' }), new Date(2026, 10, 5, 14, 30))).toBe(true);
  });

  it('без даты или без времени — не напоминает', () => {
    expect(isDueThisMinute(note({ date: null }), new Date(2026, 9, 5, 14, 30))).toBe(false);
    expect(isDueThisMinute(note({ time: null }), new Date(2026, 9, 5, 14, 30))).toBe(false);
  });
});
