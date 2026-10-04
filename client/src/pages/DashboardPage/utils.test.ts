import { describe, expect, it } from 'vitest';
import type { MonthlyRecordCountItem, MonthlyRevenueItem, SalaryHistoryItem } from '@/api/accounting.api';
import { bestSalaryMonth, buildAvgCheckData, formatThousands, overallAvgCheck } from './utils';

const rev = (key: string, amount: number): MonthlyRevenueItem =>
  ({ key, year: 2026, month: 1, label: key, labelShort: key, amount, isOverride: false });
const cnt = (key: string, count: number): MonthlyRecordCountItem =>
  ({ key, year: 2026, month: 1, label: key, labelShort: key, count, isOverride: false });
const hist = (label: string, adjustedTotal: number): SalaryHistoryItem =>
  ({ year: 2026, month: 1, label, adjustedTotal, recordCount: 1 });

describe('buildAvgCheckData', () => {
  it('делит выручку на число записей, без записей — 0', () => {
    const data = buildAvgCheckData([rev('a', 1000), rev('b', 500), rev('c', 300)], [cnt('a', 4), cnt('b', 0)]);
    expect(data.map(d => d.avg)).toEqual([250, 0, 0]);
    expect(data[0]).toMatchObject({ key: 'a', label: 'a', labelShort: 'a' });
  });
});

describe('overallAvgCheck', () => {
  it('среднее только по месяцам с записями', () => {
    const data = buildAvgCheckData([rev('a', 1000), rev('b', 0), rev('c', 600)], [cnt('a', 4), cnt('c', 2)]);
    expect(overallAvgCheck(data)).toBe(275);
  });

  it('без данных — 0', () => {
    expect(overallAvgCheck([])).toBe(0);
  });
});

describe('bestSalaryMonth', () => {
  it('находит максимум, при равенстве — первый', () => {
    expect(bestSalaryMonth([hist('янв', 100), hist('фев', 300), hist('мар', 300)])?.label).toBe('фев');
  });

  it('пустая история — null', () => {
    expect(bestSalaryMonth([])).toBeNull();
  });
});

describe('formatThousands', () => {
  it('округляет до тысяч', () => {
    expect(formatThousands(12500)).toBe('13к');
    expect(formatThousands(400)).toBe('0к');
  });
});
