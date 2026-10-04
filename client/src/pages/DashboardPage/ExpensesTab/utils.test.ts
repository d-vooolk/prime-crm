import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import type { ExpenseAnalyticsGroup, ExpenseAnalyticsMonth } from '@/api/expenses.api';
import { buildChartData, buildSeries, buildSlotMap, countElapsedMonths, parseExcluded, SERIES_SLOTS } from './utils';

const group = (key: string): ExpenseAnalyticsGroup =>
  ({ key, name: key.toUpperCase(), kind: 'category', total: 0, count: 0, items: [] });

const groups = Array.from({ length: SERIES_SLOTS + 2 }, (_, i) => group(`g${i}`));

describe('parseExcluded', () => {
  it('читает массив строк и отбрасывает лишнее', () => {
    expect(parseExcluded('["a", 1, "b"]')).toEqual(['a', 'b']);
  });

  it('пусто, не массив или битый JSON — пустой список', () => {
    expect(parseExcluded(null)).toEqual([]);
    expect(parseExcluded('{"a":1}')).toEqual([]);
    expect(parseExcluded('{oops')).toEqual([]);
  });
});

describe('buildSlotMap', () => {
  it('первые слоты по порядку, дальше — null', () => {
    const map = buildSlotMap(groups);
    expect(map.get('g0')).toBe(0);
    expect(map.get(`g${SERIES_SLOTS - 1}`)).toBe(SERIES_SLOTS - 1);
    expect(map.get(`g${SERIES_SLOTS}`)).toBeNull();
  });
});

describe('buildSeries', () => {
  it('лишние группы сворачиваются в «Остальное»', () => {
    const series = buildSeries(groups, new Set());
    expect(series).toHaveLength(SERIES_SLOTS + 1);
    expect(series[series.length - 1]).toMatchObject({ key: 'other', groupKeys: [`g${SERIES_SLOTS}`, `g${SERIES_SLOTS + 1}`] });
  });

  it('исключённая группа не перекрашивает остальные', () => {
    const series = buildSeries(groups.slice(0, 3), new Set(['g0']));
    expect(series.map(s => s.key)).toEqual(['s1', 's2']);
    expect(series[0].color).toBe('var(--expenses-series-2)');
  });

  it('без лишних групп «Остального» нет', () => {
    expect(buildSeries(groups.slice(0, 2), new Set()).map(s => s.key)).toEqual(['s0', 's1']);
  });
});

describe('buildChartData', () => {
  it('суммирует группы серии и итог месяца', () => {
    const months: ExpenseAnalyticsMonth[] = [{ month: '2026-01', totals: { a: 10, b: 5, c: 1 } }];
    const rows = buildChartData(months, [
      { key: 's0', name: 'A', color: '', groupKeys: ['a'] },
      { key: 'other', name: 'O', color: '', groupKeys: ['b', 'c', 'missing'] },
    ]);
    expect(rows[0]).toMatchObject({ month: '2026-01', s0: 10, other: 6, total: 16 });
  });
});

describe('countElapsedMonths', () => {
  it('не считает будущие месяцы', () => {
    const months = ['2026-08', '2026-09', '2026-10', '2026-11'].map(month => ({ month, totals: {} }));
    expect(countElapsedMonths(months, dayjs('2026-10-04'))).toBe(3);
  });
});
