import type { Dayjs } from 'dayjs';
import type { NotePayload } from '@/api/notes.api';
import type { NoteProject, NoteRepeat } from '@/types';

export const NOTE_PROJECTS: NoteProject[] = ['CRM', 'PRIME', 'VDF'];

export const PROJECT_LABEL: Record<NoteProject, string> = {
  CRM: 'CRM',
  PRIME: 'PRIME',
  VDF: 'VDF',
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
  project?: NoteProject;
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
    project: values.project ?? 'CRM',
    ...(servicemanId ? { servicemanId } : {}),
  };
}
