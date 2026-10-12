import dayjs, { Dayjs } from 'dayjs';
import type { CameraArchiveRange } from '@/api/camera.api';

/** Столько же, сколько разрешает сервер (cameraArchive.logic.ts) */
export const ARCHIVE_MAX_HOURS = 4;

/** Ошибка выбранного промежутка или null, если его можно выгрузить */
export function archiveRangeError(start: Dayjs | null, end: Dayjs | null): string | null {
  if (!start || !end) return 'Укажите начало и конец';
  if (!end.isAfter(start)) return 'Конец должен быть позже начала';
  if (end.diff(start, 'minute') > ARCHIVE_MAX_HOURS * 60) return `Не больше ${ARCHIVE_MAX_HOURS} часов за раз`;
  return null;
}

/** «12.10 09:02 – 18:30» или «12.10 22:00 – 13.10 01:00» для промежутков через полночь */
export function formatArchiveRange(range: CameraArchiveRange): string {
  const start = dayjs(range.start);
  const end = dayjs(range.end);
  const endFormat = start.isSame(end, 'day') ? 'HH:mm' : 'DD.MM HH:mm';
  return `${start.format('DD.MM HH:mm')} – ${end.format(endFormat)}`;
}

/** Есть ли запись хотя бы за часть выбранного промежутка */
export function overlapsArchive(ranges: CameraArchiveRange[], start: Dayjs, end: Dayjs): boolean {
  return ranges.some(r => dayjs(r.start).isBefore(end) && dayjs(r.end).isAfter(start));
}
