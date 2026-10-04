import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import type { FounderSalaryRecord, MonthlyRecordCountItem, MonthlyRevenueItem, SalaryHistoryItem } from '@/api/accounting.api';
import {
  buildAvgCheckRows, buildStatsChartData, cashAfterCardChange, debtPaidTotal, founderDescriptionRule,
  isEmployeeSalaryDescription, isFounderSalaryDescription, isLinkedSalaryDescription, monthKey,
  overallAvgCheck, parseAmount, pickDefaultPerson, salaryRecord, summarizeFounderSalaries,
} from './utils';

const rev = (key: string, amount: number): MonthlyRevenueItem => {
  const [year, month] = key.split('-').map(Number);
  return { key, year, month, label: `L${key}`, labelShort: `S${key}`, amount, isOverride: false };
};
const cnt = (key: string, count: number): MonthlyRecordCountItem => {
  const [year, month] = key.split('-').map(Number);
  return { key, year, month, label: `L${key}`, labelShort: `S${key}`, count, isOverride: false };
};
const founder = (year: number, month: number, person: string, amount: number): FounderSalaryRecord => ({
  id: `${year}-${month}-${person}-${amount}`, year, month, person, amount, cashTransactionId: null, createdAt: '',
});
const hist = (label: string, adjustedTotal: number): SalaryHistoryItem => ({ year: 2025, month: 1, label, adjustedTotal, recordCount: 1 });

describe('описания системных расходов', () => {
  it('узнаёт ЗП учредителя и сотрудника без учёта регистра и пробелов', () => {
    expect(isFounderSalaryDescription('  зп УЧРЕДИТЕЛЯ Иванов')).toBe(true);
    expect(isEmployeeSalaryDescription('ЗП сотрудника Петров')).toBe(true);
    expect(isLinkedSalaryDescription('ЗП сотрудника Петров')).toBe(true);
    expect(isLinkedSalaryDescription('Закупка расходников')).toBe(false);
    expect(isLinkedSalaryDescription(null)).toBe(false);
    expect(isLinkedSalaryDescription(undefined)).toBe(false);
  });

  it('правило формы отклоняет ручной ввод ЗП', async () => {
    await expect(founderDescriptionRule.validator(null, 'ЗП учредителя')).rejects.toThrow(/свитч/);
    await expect(founderDescriptionRule.validator(null, 'ЗП сотрудника')).rejects.toThrow(/Выплатить ЗП/);
    await expect(founderDescriptionRule.validator(null, 'Аренда')).resolves.toBeUndefined();
  });
});

describe('parseAmount / monthKey', () => {
  it('принимает запятую как десятичный разделитель', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });

  it('ключ месяца с ведущим нулём', () => {
    expect(monthKey(dayjs('2025-03-15'))).toBe('2025-03');
    expect(monthKey(dayjs('2025-11-01'))).toBe('2025-11');
  });
});

describe('debtPaidTotal', () => {
  it('суммирует погашения', () => {
    expect(debtPaidTotal({ payments: [] })).toBe(0);
    const p = { paidCurrency: 'BYN' as const, paidAmount: null, rate: null, paidAt: '', cashTransactionId: null, capitalTransactionId: null };
    expect(debtPaidTotal({ payments: [{ id: '1', amount: 100, ...p }, { id: '2', amount: 50.5, ...p }] })).toBe(150.5);
  });
});

describe('cashAfterCardChange', () => {
  it('переносит изменение карты из наличных, сохраняя общую сумму', () => {
    expect(cashAfterCardChange(1000, 0, 300)).toBe(700);
    expect(cashAfterCardChange(700, 300, 500)).toBe(500);
    expect(cashAfterCardChange(500, 500, 0)).toBe(1000);
  });

  it('не уходит в минус и округляет до копеек', () => {
    expect(cashAfterCardChange(100, 0, 250)).toBe(0);
    expect(cashAfterCardChange(0.3, 0, 0.1)).toBe(0.2);
  });
});

describe('salaryRecord', () => {
  it('без истории — нет рекорда', () => {
    expect(salaryRecord([])).toBeNull();
  });

  it('в первый месяц — текущее начисление', () => {
    expect(salaryRecord([hist('Январь', 500)], 800)).toEqual({ amount: 800, label: 'Первый месяц' });
    expect(salaryRecord([hist('Январь', 500)])).toEqual({ amount: 500, label: 'Первый месяц' });
  });

  it('иначе — максимальный месяц, при равенстве первый', () => {
    expect(salaryRecord([hist('A', 100), hist('B', 300), hist('C', 300), hist('D', 200)], 999))
      .toEqual({ amount: 300, label: 'B' });
  });
});

describe('summarizeFounderSalaries', () => {
  it('группирует по месяцам по возрастанию и считает разницу', () => {
    const s = summarizeFounderSalaries([
      founder(2025, 2, 'Дир', 100),
      founder(2024, 12, 'Созд', 300),
      founder(2025, 2, 'Созд', 50),
      founder(2025, 2, 'Дир', 20),
      founder(2025, 2, 'Чужой', 999),
    ], 'Дир', 'Созд');
    expect(s.rows).toEqual([
      { key: '12.2024', year: 2024, month: 12, director: 0, creator: 300 },
      { key: '02.2025', year: 2025, month: 2, director: 120, creator: 50 },
    ]);
    expect(s.directorTotal).toBe(120);
    expect(s.creatorTotal).toBe(350);
    expect(s.diff).toBe(230);
    expect(s.less).toBe('director');
  });

  it('без учредителей суммы нулевые, но месяцы есть', () => {
    const s = summarizeFounderSalaries([founder(2025, 1, 'X', 10)]);
    expect(s.rows).toHaveLength(1);
    expect(s.diff).toBe(0);
  });
});

describe('статистика и средний чек', () => {
  const revenue = [rev('2025-02', 1000), rev('2025-01', 600)];
  const counts = [cnt('2025-03', 4), cnt('2025-02', 10), cnt('2025-01', 0)];

  it('график — объединение месяцев от старых к новым', () => {
    const data = buildStatsChartData(revenue, counts);
    expect(data.map(d => d.key)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(data[0]).toMatchObject({ amount: 600, count: 0, avg: 0, label: 'L2025-01', labelShort: 'S2025-01' });
    expect(data[1]).toMatchObject({ amount: 1000, count: 10, avg: 100 });
    // Месяц без выручки: подпись — сам ключ
    expect(data[2]).toMatchObject({ amount: 0, count: 4, avg: 0, label: '2025-03', labelShort: '2025-03' });
  });

  it('таблица среднего чека — от новых к старым', () => {
    const rows = buildAvgCheckRows(revenue, counts);
    expect(rows.map(r => r.key)).toEqual(['2025-03', '2025-02', '2025-01']);
    expect(rows[1]).toEqual({ key: '2025-02', label: 'L2025-02', avg: 100 });
  });

  it('средний чек за всё время — по месяцам, где он есть', () => {
    expect(overallAvgCheck([])).toBe(0);
    expect(overallAvgCheck([{ key: 'a', label: '', avg: 0 }])).toBe(0);
    expect(overallAvgCheck([
      { key: 'a', label: '', avg: 100 },
      { key: 'b', label: '', avg: 0 },
      { key: 'c', label: '', avg: 300 },
    ])).toBe(200);
  });
});

describe('pickDefaultPerson', () => {
  const list = [{ name: 'Иван' }, { name: 'Пётр' }];

  it('подставляет того, кто вошёл, если он есть в списке', () => {
    expect(pickDefaultPerson('Пётр', list, 'Иван')).toBe('Пётр');
  });

  it('иначе — сотрудника по умолчанию', () => {
    expect(pickDefaultPerson('Анна', list, 'Иван')).toBe('Иван');
    expect(pickDefaultPerson(undefined, list, 'Иван')).toBe('Иван');
  });
});
