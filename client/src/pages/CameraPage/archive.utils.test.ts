import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { archiveRangeError, formatArchiveRange, overlapsArchive } from './archive.utils';

describe('archiveRangeError', () => {
  const start = dayjs('2026-10-12T09:00:00');

  it('нормальный промежуток', () => {
    expect(archiveRangeError(start, start.add(30, 'minute'))).toBeNull();
    expect(archiveRangeError(start, start.add(4, 'hour'))).toBeNull();
  });

  it('пустой, обратный и слишком длинный', () => {
    expect(archiveRangeError(null, start)).not.toBeNull();
    expect(archiveRangeError(start, start)).not.toBeNull();
    expect(archiveRangeError(start, start.subtract(1, 'minute'))).not.toBeNull();
    expect(archiveRangeError(start, start.add(4, 'hour').add(1, 'minute'))).not.toBeNull();
  });
});

describe('formatArchiveRange', () => {
  it('в пределах дня и через полночь', () => {
    expect(formatArchiveRange({ start: '2026-10-12T09:02:00', end: '2026-10-12T18:30:00' })).toBe('12.10 09:02 – 18:30');
    expect(formatArchiveRange({ start: '2026-10-12T22:00:00', end: '2026-10-13T01:00:00' })).toBe('12.10 22:00 – 13.10 01:00');
  });
});

describe('overlapsArchive', () => {
  const ranges = [{ start: '2026-10-12T09:00:00', end: '2026-10-12T12:00:00' }];

  it('пересечение есть и нет', () => {
    expect(overlapsArchive(ranges, dayjs('2026-10-12T11:00:00'), dayjs('2026-10-12T13:00:00'))).toBe(true);
    expect(overlapsArchive(ranges, dayjs('2026-10-12T12:00:00'), dayjs('2026-10-12T13:00:00'))).toBe(false);
  });
});
