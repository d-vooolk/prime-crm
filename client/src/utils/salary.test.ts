import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { averageAnnualSalary, effectiveSalaryMonth, hasSalary, roundSalaryAmount } from './salary';

describe('effectiveSalaryMonth', () => {
  it('до 25-го — текущий месяц', () => {
    expect(effectiveSalaryMonth(dayjs('2026-03-24')).format('YYYY-MM-DD')).toBe('2026-03-01');
  });

  it('с 25-го — уже следующий месяц', () => {
    expect(effectiveSalaryMonth(dayjs('2026-03-25')).format('YYYY-MM-DD')).toBe('2026-04-01');
  });

  it('25 декабря переходит на январь следующего года', () => {
    expect(effectiveSalaryMonth(dayjs('2026-12-25')).format('YYYY-MM-DD')).toBe('2027-01-01');
  });
});

describe('averageAnnualSalary', () => {
  const today = dayjs('2026-06-10'); // расчётный период — июнь 2026

  it('без истории — ноль', () => {
    expect(averageAnnualSalary([], today)).toEqual({ average: 0, monthsCount: 0 });
  });

  it('не учитывает текущий период и месяцы старше 12', () => {
    const res = averageAnnualSalary([
      { year: 2026, month: 6, adjustedTotal: 9999 }, // текущий — мимо
      { year: 2026, month: 5, adjustedTotal: 1000 },
      { year: 2025, month: 6, adjustedTotal: 3000 }, // ровно 12 месяцев назад — в окне
      { year: 2025, month: 5, adjustedTotal: 9999 }, // 13 месяцев назад — мимо
    ], today);
    expect(res).toEqual({ average: 2000, monthsCount: 2 });
  });

  it('делит на число месяцев с данными, а не на 12', () => {
    const res = averageAnnualSalary([
      { year: 2026, month: 4, adjustedTotal: 500 },
      { year: 2026, month: 5, adjustedTotal: 1500 },
    ], today);
    expect(res.average).toBe(1000);
  });
});

describe('roundSalaryAmount', () => {
  it('дробную сумму округляет до целых в нужную сторону', () => {
    expect(roundSalaryAmount(100.4, 'up')).toBe(101);
    expect(roundSalaryAmount(100.6, 'down')).toBe(100);
  });

  it('целую сумму меняет на шаг', () => {
    expect(roundSalaryAmount(100, 'up')).toBe(101);
    expect(roundSalaryAmount(100, 'down')).toBe(99);
  });

  it('погрешность Float считается целым числом', () => {
    expect(roundSalaryAmount(1234.9999999, 'up')).toBe(1236);
  });

  it('ниже нуля не уходит', () => {
    expect(roundSalaryAmount(0, 'down')).toBe(0);
  });
});

describe('hasSalary', () => {
  it('сотруднику считается всегда', () => {
    expect(hasSalary({ role: 'Сотрудник', profitPercent: 0, baseSalary: 0 })).toBe(true);
  });

  it('остальным — только с окладом или процентом', () => {
    expect(hasSalary({ role: 'Менеджер', profitPercent: 0, baseSalary: 0 })).toBe(false);
    expect(hasSalary({ role: 'Менеджер', profitPercent: 10 })).toBe(true);
    expect(hasSalary({ role: 'Директор', profitPercent: 0, baseSalary: 1500 })).toBe(true);
  });
});
