import { describe, expect, it } from 'vitest';
import { ARCHIVE_MAX_EXPORT_SECONDS, exportDurationSeconds, exportFileName, pickFilesToDelete } from '../services/cameraArchive.logic';

const file = (path: string, size: number, mtimeMs: number) => ({ path, size, mtimeMs });

describe('pickFilesToDelete', () => {
  it('в пределах лимита ничего не удаляет', () => {
    expect(pickFilesToDelete([file('a', 5, 1), file('b', 5, 2)], 10)).toEqual([]);
  });

  it('сверх лимита удаляет самые старые, пока не влезет', () => {
    const files = [file('new', 4, 30), file('old', 4, 10), file('mid', 4, 20)];
    expect(pickFilesToDelete(files, 5).map(f => f.path)).toEqual(['old', 'mid']);
  });

  it('самый новый кусок не удаляет, даже если он один больше лимита', () => {
    expect(pickFilesToDelete([file('only', 100, 1)], 10)).toEqual([]);
    expect(pickFilesToDelete([file('old', 1, 1), file('big', 100, 2)], 10).map(f => f.path)).toEqual(['old']);
  });
});

describe('exportDurationSeconds', () => {
  const start = new Date('2026-10-12T06:00:00Z');

  it('обычный промежуток — в секундах', () => {
    expect(exportDurationSeconds(start, new Date('2026-10-12T06:30:00Z'))).toBe(1800);
  });

  it('конец раньше начала, ноль и слишком длинный — некорректно', () => {
    expect(exportDurationSeconds(start, new Date('2026-10-12T05:00:00Z'))).toBeNull();
    expect(exportDurationSeconds(start, start)).toBeNull();
    expect(exportDurationSeconds(start, new Date(start.getTime() + (ARCHIVE_MAX_EXPORT_SECONDS + 1) * 1000))).toBeNull();
  });
});

describe('exportFileName', () => {
  it('минское время в имени', () => {
    expect(exportFileName(new Date('2026-10-12T06:05:00Z'))).toBe('camera_2026-10-12_09-05.mp4');
  });
});
