import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { buildNotePayload } from './notesHelpers';

describe('buildNotePayload', () => {
  it('без даты сбрасывает время и повтор', () => {
    const p = buildNotePayload({ text: 'a', allDay: false, time: dayjs('2026-01-01T10:30'), hasRepeat: true, repeat: 'DAILY' });
    expect(p).toEqual({ text: 'a', date: null, allDay: false, time: null, repeat: null, priority: 'LOW' });
  });

  it('с датой и не на весь день сохраняет время HH:mm', () => {
    const date = dayjs('2026-03-05T00:00');
    const p = buildNotePayload({ text: 'b', date, allDay: false, time: dayjs('2026-01-01T09:05'), priority: 'HIGH' });
    expect(p.date).toBe(date.toISOString());
    expect(p.time).toBe('09:05');
    expect(p.priority).toBe('HIGH');
  });

  it('на весь день время не отправляет, по умолчанию allDay = true', () => {
    const p = buildNotePayload({ text: 'c', date: dayjs(), time: dayjs() });
    expect(p.allDay).toBe(true);
    expect(p.time).toBeNull();
  });

  it('повтор только при включённом переключателе', () => {
    expect(buildNotePayload({ text: 'd', date: dayjs(), hasRepeat: false, repeat: 'WEEKLY' }).repeat).toBeNull();
    expect(buildNotePayload({ text: 'd', date: dayjs(), hasRepeat: true, repeat: 'WEEKLY' }).repeat).toBe('WEEKLY');
  });

  it('servicemanId добавляется только если передан', () => {
    expect(buildNotePayload({ text: 'e' })).not.toHaveProperty('servicemanId');
    expect(buildNotePayload({ text: 'e' }, 's1').servicemanId).toBe('s1');
  });
});
