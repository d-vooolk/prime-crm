import {useEffect, useRef} from 'react';
import dayjs from 'dayjs';
import {notesApi} from '@/api/notes.api';
import {Note} from '@/types';

function getNotificationKey(note: Note): string {
  const today = dayjs().format('YYYY-MM-DD');
  if (!note.repeat) return `note-${note.id}`;
  if (note.repeat === 'DAILY') return `note-${note.id}-${today}`;
  if (note.repeat === 'WEEKLY') return `note-${note.id}-w${dayjs().day()}-${today.slice(0, 7)}`;
  if (note.repeat === 'MONTHLY') return `note-${note.id}-m${dayjs().date()}-${today.slice(0, 7)}`;
  return `note-${note.id}`;
}

function wasNotified(key: string): boolean {
  try {
    const raw = sessionStorage.getItem('prime-crm-notified') || '{}';
    return JSON.parse(raw)[key] === true;
  } catch { return false; }
}

function markNotified(key: string): void {
  try {
    const raw = sessionStorage.getItem('prime-crm-notified') || '{}';
    const map = JSON.parse(raw);
    map[key] = true;
    sessionStorage.setItem('prime-crm-notified', JSON.stringify(map));
  } catch { /* ignore */ }
}

function shouldFireNow(note: Note): boolean {
  if (!note.date) return false;
  const now = dayjs();
  const noteDate = dayjs(note.date);

  if (note.allDay) {
    const sameDay = (() => {
      if (!note.repeat) return noteDate.isSame(now, 'day');
      if (note.repeat === 'DAILY') return true;
      if (note.repeat === 'WEEKLY') return now.day() === noteDate.day();
      if (note.repeat === 'MONTHLY') return now.date() === noteDate.date();
      return false;
    })();
    if (!sameDay) return false;
    const target = now.hour(9).minute(0).second(0);
    return Math.abs(now.diff(target, 'minute')) <= 1;
  }

  if (!note.time) return false;
  const [h, m] = note.time.split(':').map(Number);

  const matchesDate = (() => {
    if (!note.repeat) return noteDate.isSame(now, 'day');
    if (note.repeat === 'DAILY') return true;
    if (note.repeat === 'WEEKLY') return now.day() === noteDate.day();
    if (note.repeat === 'MONTHLY') return now.date() === noteDate.date();
    return false;
  })();

  if (!matchesDate) return false;
  const target = now.hour(h).minute(m).second(0);
  return Math.abs(now.diff(target, 'minute')) <= 1;
}

export function useNotesNotifications() {
  const notesRef = useRef<Note[]>([]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const fetchNotes = async () => {
      try {
        notesRef.current = await notesApi.getAll(undefined, false);
      } catch { /* ignore */ }
    };

    fetchNotes();
    const fetchInterval = setInterval(fetchNotes, 5 * 60 * 1000);

    const checkInterval = setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      for (const note of notesRef.current) {
        if (note.isDone) continue;
        if (!shouldFireNow(note)) continue;
        const key = getNotificationKey(note);
        if (wasNotified(key)) continue;
        markNotified(key);
        try {
          const priorityEmoji = { LOW: '🔵', MEDIUM: '🟡', HIGH: '🔴' }[note.priority] || '';
          new Notification(`${priorityEmoji} Напоминание`, {
            body: note.text,
            icon: '/favicon.ico',
          });
        } catch { /* ignore */ }
      }
    }, 60 * 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(checkInterval);
    };
  }, []);
}

