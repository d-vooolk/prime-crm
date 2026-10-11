import { describe, expect, it } from 'vitest';
import { achievements, growthStreak, lastDeltaPct, levelThreshold, monthGoal, workshopLevel } from './gamification';

describe('workshopLevel', () => {
  it('пороги уровней растут', () => {
    expect([1, 2, 3, 4, 5].map(levelThreshold)).toEqual([0, 50, 150, 300, 500]);
  });

  it('без записей — первый уровень с пустой шкалой', () => {
    expect(workshopLevel(0)).toMatchObject({ level: 1, title: 'Старт', earned: 0, needed: 50, progress: 0 });
  });

  it('на пороге — уже следующий уровень', () => {
    expect(workshopLevel(150)).toMatchObject({ level: 3, title: 'Разгон', earned: 0, needed: 150 });
  });

  it('прогресс внутри уровня', () => {
    const info = workshopLevel(400);
    expect(info.level).toBe(4);
    expect(info.progress).toBeCloseTo(0.5);
  });
});

describe('monthGoal', () => {
  const series = [
    { year: 2026, month: 8, value: 100 },
    { year: 2026, month: 9, value: 200 },
    { year: 2026, month: 10, value: 150 },
  ];

  it('цель — лучший из прошлых месяцев', () => {
    expect(monthGoal(series, 2026, 10)).toMatchObject({ current: 150, best: 200, previous: 200, progress: 0.75, isRecord: false, deltaPct: -25 });
  });

  it('рекорд, если текущий выше всех прошлых', () => {
    expect(monthGoal(series, 2026, 9)).toMatchObject({ best: 100, isRecord: true, progress: 1, deltaPct: 100 });
  });

  it('январь сравнивается с декабрём прошлого года', () => {
    const goal = monthGoal([{ year: 2025, month: 12, value: 50 }, { year: 2026, month: 1, value: 75 }], 2026, 1);
    expect(goal.previous).toBe(50);
    expect(goal.deltaPct).toBe(50);
  });

  it('без истории сравнивать не с чем', () => {
    expect(monthGoal([], 2026, 10)).toMatchObject({ current: 0, best: 0, progress: 0, isRecord: false, deltaPct: null });
  });
});

describe('growthStreak и lastDeltaPct', () => {
  it('считает рост с конца до первого спада', () => {
    expect(growthStreak([5, 3, 4, 6, 9])).toBe(3);
    expect(growthStreak([5, 6, 4])).toBe(0);
    expect(growthStreak([])).toBe(0);
  });

  it('изменение последнего значения', () => {
    expect(lastDeltaPct([100, 120])).toBeCloseTo(20);
    expect(lastDeltaPct([0, 120])).toBeNull();
    expect(lastDeltaPct([5])).toBeNull();
  });
});

describe('achievements', () => {
  const goal = monthGoal([{ year: 2026, month: 9, value: 10 }, { year: 2026, month: 10, value: 12 }], 2026, 10);

  it('без выручки не показывает достижение по кассе', () => {
    const list = achievements({ totalRecords: 120, recordsGoal: goal, revenueGoal: null, streak: 1, topServiceCount: 5 });
    expect(list.map(a => a.id)).not.toContain('month-revenue');
    expect(list.find(a => a.id === 'records-100')?.unlocked).toBe(true);
    expect(list.find(a => a.id === 'month-records')?.unlocked).toBe(true);
    expect(list.find(a => a.id === 'streak-3')?.progress).toBeCloseTo(1 / 3);
  });

  it('недобитый рекорд не засчитывается даже при 100% округлении', () => {
    const equal = monthGoal([{ year: 2026, month: 9, value: 10 }, { year: 2026, month: 10, value: 10 }], 2026, 10);
    const list = achievements({ totalRecords: 0, recordsGoal: equal, revenueGoal: equal, streak: 0, topServiceCount: 0 });
    expect(list.find(a => a.id === 'month-revenue')?.unlocked).toBe(false);
  });
});
