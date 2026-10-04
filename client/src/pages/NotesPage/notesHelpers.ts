import type { Dayjs } from 'dayjs';
import type { NotePayload } from '@/api/notes.api';
import type { NotePriority, NoteRepeat } from '@/types';

export const PRIORITY_LABEL: Record<NotePriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
};

export const REPEAT_LABEL: Record<NoteRepeat, string> = {
  DAILY: 'Каждый день',
  WEEKLY: 'Каждую неделю',
  MONTHLY: 'Каждый месяц',
};

/** Значения формы заметки */
export interface NoteFormValues {
  text: string;
  date?: Dayjs | null;
  allDay?: boolean;
  time?: Dayjs | null;
  hasRepeat?: boolean;
  repeat?: NoteRepeat;
  priority?: NotePriority;
}

/**
 * Форма → тело запроса. Время и повтор имеют смысл только при заданной дате,
 * время — только если заметка не на весь день. servicemanId — когда Создатель
 * пишет заметку сотруднику.
 */
export function buildNotePayload(values: NoteFormValues, servicemanId?: string | null): NotePayload {
  const hasDate = !!values.date;
  const isAllDay = values.allDay ?? true;
  return {
    text: values.text,
    date: hasDate ? values.date!.toISOString() : null,
    allDay: isAllDay,
    time: hasDate && !isAllDay && values.time ? values.time.format('HH:mm') : null,
    repeat: hasDate && values.hasRepeat && values.repeat ? values.repeat : null,
    priority: values.priority ?? 'LOW',
    ...(servicemanId ? { servicemanId } : {}),
  };
}
