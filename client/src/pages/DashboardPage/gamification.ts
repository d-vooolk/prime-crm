/**
 * Геймификация дашборда: уровень мастерской по числу записей, цель месяца (рекорд),
 * серия роста и достижения. Всё считается из помесячных рядов — отдельно на сервере не хранится.
 */

export interface MonthPoint {
  year: number;
  /** 1–12 */
  month: number;
  value: number;
}

// ─── Уровень мастерской ─────────────────────────────

export interface LevelInfo {
  level: number;
  title: string;
  /** Записей набрано на текущем уровне */
  earned: number;
  /** Сколько нужно записей с начала уровня до следующего */
  needed: number;
  /** 0..1 — заполненность шкалы до следующего уровня */
  progress: number;
}

/** Порог уровня n: 25·n·(n−1) записей → 1: 0, 2: 50, 3: 150, 4: 300, 5: 500, 10: 2250 */
export const levelThreshold = (level: number) => 25 * level * (level - 1);

const LEVEL_TITLES: { from: number; title: string }[] = [
  { from: 1, title: 'Старт' },
  { from: 3, title: 'Разгон' },
  { from: 5, title: 'Профи' },
  { from: 8, title: 'Эксперт' },
  { from: 11, title: 'Легенда' },
];

export function workshopLevel(totalRecords: number): LevelInfo {
  const total = Math.max(0, Math.floor(totalRecords));
  let level = 1;
  while (levelThreshold(level + 1) <= total) level++;
  const from = levelThreshold(level);
  const needed = levelThreshold(level + 1) - from;
  const earned = total - from;
  const title = [...LEVEL_TITLES].reverse().find(t => level >= t.from)?.title ?? LEVEL_TITLES[0].title;
  return { level, title, earned, needed, progress: earned / needed };
}

// ─── Цель месяца ────────────────────────────────────

export interface MonthGoal {
  current: number;
  /** Лучший из прошлых месяцев (цель); 0 — истории нет */
  best: number;
  /** Прошлый месяц */
  previous: number;
  /** 0..1 — доля от рекорда (без истории — 1, если в месяце что-то есть) */
  progress: number;
  /** Текущий месяц уже побил прошлый рекорд */
  isRecord: boolean;
  /** Изменение к прошлому месяцу в процентах; null — сравнивать не с чем */
  deltaPct: number | null;
}

const isSameMonth = (p: MonthPoint, year: number, month: number) => p.year === year && p.month === month;

/** Текущий месяц против лучшего из предыдущих */
export function monthGoal(series: MonthPoint[], year: number, month: number): MonthGoal {
  const current = series.find(p => isSameMonth(p, year, month))?.value ?? 0;
  const past = series.filter(p => p.year < year || (p.year === year && p.month < month));
  const best = past.reduce((max, p) => Math.max(max, p.value), 0);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const previous = series.find(p => isSameMonth(p, prevYear, prevMonth))?.value ?? 0;
  return {
    current,
    best,
    previous,
    progress: best > 0 ? Math.min(1, current / best) : (current > 0 ? 1 : 0),
    isRecord: best > 0 && current > best,
    deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/** Изменение последнего значения к предыдущему, % (null — не с чем сравнивать) */
export function lastDeltaPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const last = values[values.length - 1];
  return prev > 0 ? ((last - prev) / prev) * 100 : null;
}

// ─── Серия роста ────────────────────────────────────

/** Сколько завершённых месяцев подряд (с последнего) значение росло к предыдущему */
export function growthStreak(completed: number[]): number {
  let streak = 0;
  for (let i = completed.length - 1; i > 0; i--) {
    if (completed[i] > completed[i - 1]) streak++;
    else break;
  }
  return streak;
}

// ─── Достижения ─────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** 0..1 — прогресс к получению (у полученных — 1) */
  progress: number;
}

export interface AchievementInput {
  totalRecords: number;
  /** Рекорд месяца по числу записей */
  recordsGoal: MonthGoal;
  /** Рекорд месяца по выручке; null — роли выручка не видна */
  revenueGoal: MonthGoal | null;
  streak: number;
  /** Самая частая услуга за период */
  topServiceCount: number;
}

const ratio = (value: number, target: number) => Math.min(1, Math.max(0, target > 0 ? value / target : 0));

export function achievements(input: AchievementInput): Achievement[] {
  const { totalRecords, recordsGoal, revenueGoal, streak, topServiceCount } = input;
  const list: Omit<Achievement, 'unlocked'>[] = [
    { id: 'records-100', title: 'Сотня', description: '100 записей за всё время', progress: ratio(totalRecords, 100) },
    { id: 'records-1000', title: 'Тысячник', description: '1000 записей за всё время', progress: ratio(totalRecords, 1000) },
    {
      id: 'month-records',
      title: 'Аншлаг',
      description: 'Больше записей, чем в любом прошлом месяце',
      progress: recordsGoal.isRecord ? 1 : recordsGoal.progress * 0.99,
    },
    ...(revenueGoal ? [{
      id: 'month-revenue',
      title: 'Рекордная касса',
      description: 'Выручка месяца выше прошлого рекорда',
      progress: revenueGoal.isRecord ? 1 : revenueGoal.progress * 0.99,
    }] : []),
    { id: 'streak-3', title: 'На подъёме', description: '3 месяца роста подряд', progress: ratio(streak, 3) },
    { id: 'hit-service', title: 'Хит периода', description: 'Одна услуга — 30 раз за период', progress: ratio(topServiceCount, 30) },
  ];
  return list.map(a => ({ ...a, unlocked: a.progress >= 1 }));
}
