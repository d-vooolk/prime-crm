export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Локальная полночь дня из строки YYYY-MM-DD (или начала ISO-строки). new Date('2026-09-01')
 * дал бы полночь по UTC — в Минске это уже 03:00, и граница дня поехала бы.
 */
export function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Начало следующего дня — правая граница «по дату включительно» */
export function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}
