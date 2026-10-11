/**
 * Событие записи для календаря клиента: файл .ics (iPhone, Android, Outlook открывают его
 * сразу в календаре) и ссылка «добавить в Google Календарь». Время — в UTC, календарь
 * сам покажет его по часовому поясу телефона.
 */

export interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  location: string;
  url: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 20261017T070000Z */
export function formatIcsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Экранирование текста по RFC 5545: \ ; , и переносы строк */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Строки длиннее 75 байт переносятся (продолжение начинается с пробела); кириллицу не режем посередине */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = parts.length ? 74 : 75; // у продолжения первый байт — пробел
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prime Auto//Zapis//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(e.start)}`,
    `DTEND:${formatIcsDate(e.end)}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `DESCRIPTION:${escapeIcsText(e.description)}`,
    `LOCATION:${escapeIcsText(e.location)}`,
    `URL:${e.url}`,
    // Напоминание за 2 часа
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(e.title)}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Ссылка «добавить событие» в Google Календарь (Android без приложения для .ics) */
export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${formatIcsDate(e.start)}/${formatIcsDate(e.end)}`,
    details: `${e.description}\n\n${e.url}`,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
