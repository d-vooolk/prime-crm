import { prisma } from '../prisma/client';
import { pushService } from './push.service';

/**
 * Напоминания заметок пушем — приходят, даже когда CRM закрыта. Проверка раз в минуту.
 * Правила те же, что у уведомлений в браузере (client/src/hooks/useNotesNotifications.ts):
 * заметка на весь день — в 9:00, со временем — в указанное время; повтор каждый день,
 * неделю (тот же день недели) или месяц (то же число).
 */
export interface ReminderNote {
  id: string;
  date: Date | null;
  allDay: boolean;
  time: string | null;
  repeat: string | null;
}

const ALL_DAY_HOUR = 9;

function matchesDay(note: ReminderNote, now: Date): boolean {
  const d = note.date!;
  switch (note.repeat) {
    case 'DAILY': return true;
    case 'WEEKLY': return now.getDay() === d.getDay();
    case 'MONTHLY': return now.getDate() === d.getDate();
    default:
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
}

/** Пора ли напомнить в эту минуту */
export function isDueThisMinute(note: ReminderNote, now: Date): boolean {
  if (!note.date || !matchesDay(note, now)) return false;
  let hour = ALL_DAY_HOUR;
  let minute = 0;
  if (!note.allDay) {
    if (!note.time) return false;
    [hour, minute] = note.time.split(':').map(Number);
  }
  return now.getHours() === hour && now.getMinutes() === minute;
}

// Уже отправленные в эту минуту (защита от двойного срабатывания таймера)
const sent = new Set<string>();

export async function sendDueNoteReminders(now = new Date()) {
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  const notes = await prisma.note.findMany({
    where: { isDone: false, date: { not: null } },
    select: { id: true, text: true, date: true, allDay: true, time: true, repeat: true, servicemanId: true },
  });
  for (const note of notes) {
    if (!isDueThisMinute(note, now)) continue;
    const key = `${note.id}@${minuteKey}`;
    if (sent.has(key)) continue;
    sent.add(key);
    await pushService.sendToUsers([note.servicemanId], {
      title: 'Напоминание',
      body: note.text.length > 180 ? `${note.text.slice(0, 177)}…` : note.text,
      url: '/notes',
      tag: `note-${note.id}`,
    });
  }
  if (sent.size > 5000) sent.clear();
}
