import { describe, it, expect } from 'vitest';
import {
  salaryPeriod, servicemanShare, effectivePercent, paymentFor, adjustedTotal, paymentType, dealPayments,
} from '../services/accounting/salaryCalc';
import { effectiveSalaryMonth, baseSalaryFor, monthsWithBaseSalary } from '../services/salaryRates';

describe('salaryPeriod', () => {
  it('с 25-го прошлого месяца по 24-е текущего', () => {
    const { from, to } = salaryPeriod(2026, 3);
    expect(from).toEqual(new Date(2026, 1, 25));
    expect(to).toEqual(new Date(2026, 2, 25));
  });

  it('январь начинается в декабре прошлого года', () => {
    expect(salaryPeriod(2026, 1).from).toEqual(new Date(2025, 11, 25));
  });
});

describe('effectiveSalaryMonth', () => {
  it('до 25-го — текущий месяц, с 25-го — следующий', () => {
    expect(effectiveSalaryMonth(new Date(2026, 4, 24))).toEqual({ year: 2026, month: 5 });
    expect(effectiveSalaryMonth(new Date(2026, 4, 25))).toEqual({ year: 2026, month: 6 });
    expect(effectiveSalaryMonth(new Date(2026, 11, 26))).toEqual({ year: 2027, month: 1 });
  });
});

describe('servicemanShare', () => {
  it('без дележа — вся прибыль исполнителю', () => {
    const item = { servicemanName: 'Иван', servicemanSplit: null, netProfit: 100 };
    expect(servicemanShare(item, 'Иван')).toBe(100);
    expect(servicemanShare(item, 'Пётр')).toBeNull();
  });

  it('прибыль не посчитана — доля 0, а не null', () => {
    expect(servicemanShare({ servicemanName: 'Иван', servicemanSplit: null, netProfit: null }, 'Иван')).toBe(0);
  });

  it('при дележе — своя часть', () => {
    const item = {
      servicemanName: null,
      servicemanSplit: [{ name: 'Иван', amount: 60 }, { name: 'Пётр', amount: 40 }],
      netProfit: 100,
    };
    expect(servicemanShare(item, 'Пётр')).toBe(40);
    expect(servicemanShare(item, 'Олег')).toBeNull();
  });
});

describe('effectivePercent', () => {
  it('услуга → категория → личный процент', () => {
    expect(effectivePercent({ customPercent: 30, category: { customPercent: 20 } }, 10)).toBe(30);
    expect(effectivePercent({ customPercent: null, category: { customPercent: 20 } }, 10)).toBe(20);
    expect(effectivePercent({ customPercent: null, category: { customPercent: null } }, 10)).toBe(10);
    // 0% у услуги — тоже значение, а не «не задано»
    expect(effectivePercent({ customPercent: 0, category: { customPercent: 20 } }, 10)).toBe(0);
  });
});

describe('paymentFor', () => {
  it('процент от доли с округлением до копейки', () => {
    expect(paymentFor(333.33, 15)).toBe(50);
    expect(paymentFor(100, 12.5)).toBe(12.5);
  });
});

describe('adjustedTotal и тип выплаты', () => {
  it('работы + оклад + премии − штрафы', () => {
    expect(adjustedTotal(500, 1000, [
      { type: 'BONUS', amount: 100 },
      { type: 'FINE', amount: 50 },
      { type: 'BONUS', amount: 25 },
    ])).toBe(1575);
  });

  it('выплата всего остатка — расчёт, меньше — аванс', () => {
    expect(paymentType(300, 300)).toBe('FINAL');
    expect(paymentType(301, 300)).toBe('FINAL');
    expect(paymentType(299.99, 300)).toBe('ADVANCE');
  });
});

describe('оклад по истории', () => {
  const rates = [
    { year: 2026, month: 1, amount: 1000 },
    { year: 2026, month: 4, amount: 1200 },
  ];

  it('действует последняя запись, начавшаяся не позже месяца', () => {
    expect(baseSalaryFor(rates, { year: 2025, month: 12 })).toBe(0);
    expect(baseSalaryFor(rates, { year: 2026, month: 3 })).toBe(1000);
    expect(baseSalaryFor(rates, { year: 2026, month: 4 })).toBe(1200);
  });

  it('месяцы с окладом — от первой записи до указанного', () => {
    expect(monthsWithBaseSalary(rates, { year: 2026, month: 5 })).toHaveLength(5);
  });
});

describe('dealPayments', () => {
  const service = (customPercent: number | null = null, categoryPercent: number | null = null) =>
    ({ customPercent, category: { customPercent: categoryPercent } });

  it('считает каждому его процент со своих позиций', () => {
    const items = [
      { servicemanName: 'Иван', servicemanSplit: null, netProfit: 1000, service: service() },
      { servicemanName: 'Пётр', servicemanSplit: null, netProfit: 500, service: service(20) },
      { servicemanName: 'Иван', servicemanSplit: null, netProfit: 200, service: service(null, 50) },
    ];
    const result = dealPayments(items, new Map([['Иван', 30], ['Пётр', 10]]));
    expect(result.get('Иван')).toBe(400); // 1000 × 30% + 200 × 50%
    expect(result.get('Пётр')).toBe(100); // свой процент услуги 20%
  });

  it('при дележе — процент с части каждого', () => {
    const items = [{
      servicemanName: null,
      servicemanSplit: [{ name: 'Иван', amount: 600 }, { name: 'Пётр', amount: 400 }],
      netProfit: 1000,
      service: service(),
    }];
    const result = dealPayments(items, new Map([['Иван', 10], ['Пётр', 25]]));
    expect(result.get('Иван')).toBe(60);
    expect(result.get('Пётр')).toBe(100);
  });

  it('позиции без исполнителя никому не идут', () => {
    const items = [{ servicemanName: null, servicemanSplit: null, netProfit: 1000, service: service() }];
    expect(dealPayments(items, new Map()).size).toBe(0);
  });

  it('сотрудник без процента получает 0', () => {
    const items = [{ servicemanName: 'Иван', servicemanSplit: null, netProfit: 1000, service: service() }];
    expect(dealPayments(items, new Map()).get('Иван')).toBe(0);
  });
});
