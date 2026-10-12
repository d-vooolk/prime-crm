/**
 * Архив камеры ограничен по объёму (CAMERA_ARCHIVE_MAX_GB): сверх лимита удаляются самые
 * старые куски записи. Последний (самый новый) кусок не трогаем никогда — MediaMTX
 * может как раз в него писать.
 */
export interface ArchiveFile {
  path: string;
  size: number;
  /** Время изменения, мс */
  mtimeMs: number;
}

export function pickFilesToDelete(files: ArchiveFile[], maxBytes: number): ArchiveFile[] {
  const sorted = [...files].sort((a, b) => a.mtimeMs - b.mtimeMs);
  let total = sorted.reduce((sum, f) => sum + f.size, 0);
  const result: ArchiveFile[] = [];
  for (const file of sorted.slice(0, -1)) {
    if (total <= maxBytes) break;
    result.push(file);
    total -= file.size;
  }
  return result;
}

/**
 * Самый длинный промежуток выгрузки за раз. По умолчанию выгружается весь архив
 * (от самой ранней записи до сейчас), а 10 ГБ — это около 15 часов, так что сутки — с запасом
 */
export const ARCHIVE_MAX_EXPORT_SECONDS = 24 * 60 * 60;

/** Промежуток выгрузки: конец позже начала и не длиннее лимита. null — промежуток некорректен */
export function exportDurationSeconds(start: Date, end: Date): number | null {
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > ARCHIVE_MAX_EXPORT_SECONDS) return null;
  return seconds;
}

/** Имя файла выгрузки: camera_2026-10-12_09-00.mp4 (время — минское) */
export function exportFileName(start: Date, timeZone = 'Europe/Minsk'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(start);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `camera_${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}.mp4`;
}
