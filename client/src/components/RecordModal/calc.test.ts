import { describe, expect, it } from 'vitest';
import type { Category, Service } from '@/types';
import type { SelectedService } from './types';
import {
  addService, formatHoursMinutes, formatMileage, formatPlateNumber, generationYears, groupThousands,
  initialSplitEntries, isPhoneValid, itemNetProfit, prepaidFromDraft, prepayDraftFromItem,
  servicesTotals, sortCategoriesByUsage, validateSplit,
} from './calc';

const item = (over: Partial<SelectedService> = {}): SelectedService => ({
  serviceId: 's1', serviceName: 'Замена линз', categoryName: 'Фары',
  price: 100, quantity: 1, estimatedTime: 60, ...over,
});

const service = (over: Partial<Service> = {}): Service => ({
  id: 's1', name: 'Замена линз', categoryId: 'c1', standardPrice: 150, estimatedTime: 90, isActive: true, ...over,
} as Service);

describe('formatPlateNumber', () => {
  it('расставляет пробел и дефис, приводит к верхнему регистру', () => {
    expect(formatPlateNumber('1234ab7')).toBe('1234 AB-7');
  });
  it('игнорирует введённые пробелы и дефисы и обрезает до 7 символов', () => {
    expect(formatPlateNumber('12 34-аа-79999')).toBe('1234 АА-7');
  });
  it('частичный ввод', () => {
    expect(formatPlateNumber('123')).toBe('123');
    expect(formatPlateNumber('12345')).toBe('1234 5');
  });
});

describe('formatMileage', () => {
  it('оставляет только цифры и группирует разряды', () => {
    expect(formatMileage('150000км')).toBe('150 000');
  });
  it('не больше 7 цифр', () => {
    expect(formatMileage('123456789')).toBe('1 234 567');
  });
  it('пустая строка без цифр', () => {
    expect(formatMileage('abc')).toBe('');
  });
});

describe('generationYears', () => {
  it('годы поколения от новых к старым', () => {
    expect(generationYears({ year_from: 2018, year_to: 2020 })).toEqual(['2020', '2019', '2018']);
  });
  it('без года окончания — до текущего', () => {
    expect(generationYears({ year_from: 2023, year_to: null }, 2025)).toEqual(['2025', '2024', '2023']);
  });
  it('без годов — 31 год назад от текущего', () => {
    const years = generationYears({ year_from: null, year_to: null }, 2025);
    expect(years).toHaveLength(31);
    expect(years[0]).toBe('2025');
    expect(years[30]).toBe('1995');
  });
  it('без поколения — пусто', () => {
    expect(generationYears(undefined)).toEqual([]);
  });
});

describe('isPhoneValid', () => {
  it('полный номер с кодом страны', () => {
    expect(isPhoneValid('+375 (29) 123-45-67')).toBe(true);
  });
  it('неполный номер', () => {
    expect(isPhoneValid('+375 (29) 123')).toBe(false);
  });
});

describe('servicesTotals', () => {
  it('сумма, время, предоплата и остаток с учётом количества', () => {
    const totals = servicesTotals([
      item({ price: 100, quantity: 2, estimatedTime: 30, prepaidAmount: 50 }),
      item({ serviceId: 's2', price: 40, quantity: 1, estimatedTime: 15 }),
    ]);
    expect(totals).toEqual({ total: 240, totalTime: 75, totalPrepaid: 50, remaining: 190 });
  });
  it('пустой список', () => {
    expect(servicesTotals([])).toEqual({ total: 0, totalTime: 0, totalPrepaid: 0, remaining: 0 });
  });
});

describe('форматирование', () => {
  it('formatHoursMinutes', () => {
    expect(formatHoursMinutes(125)).toBe('2ч 5м');
    expect(formatHoursMinutes(0)).toBe('0ч 0м');
  });
  it('groupThousands', () => {
    expect(groupThousands(1234567)).toBe('1 234 567');
    expect(groupThousands('950')).toBe('950');
  });
});

describe('addService', () => {
  it('новая услуга добавляется со стандартной ценой', () => {
    const result = addService([], service({ hasEquipment: true }), 'Фары');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      serviceId: 's1', categoryName: 'Фары', price: 150, quantity: 1, estimatedTime: 90,
      hasEquipment: true, isProduct: false, prepaidAmount: 0, prepaidByCard: false,
    });
  });
  it('повторный выбор увеличивает количество, цену не трогает', () => {
    const result = addService([item({ price: 120 })], service(), 'Фары');
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].price).toBe(120);
  });
});

describe('sortCategoriesByUsage', () => {
  it('популярные категории и услуги выше, при равенстве порядок сохраняется', () => {
    const cats = [
      { id: 'a', name: 'A', services: [service({ id: 'a1', usageCount: 1 })] },
      { id: 'b', name: 'B', services: [service({ id: 'b1', usageCount: 2 }), service({ id: 'b2', usageCount: 5 }), service({ id: 'b3', usageCount: 5 })] },
    ] as Category[];
    const sorted = sortCategoriesByUsage(cats);
    expect(sorted.map(c => c.id)).toEqual(['b', 'a']);
    expect(sorted[0].services.map(s => s.id)).toEqual(['b2', 'b3', 'b1']);
    // Исходный массив не меняется
    expect(cats[0].id).toBe('a');
  });
});

describe('itemNetProfit', () => {
  const equipment = [{ id: 'e1', name: 'Bi-Led', retailPrice: 300 }];
  it('сумма позиции минус розничная цена оборудования', () => {
    expect(itemNetProfit(item({ price: 500, quantity: 1, hasEquipment: true, equipmentId: 'e1' }), equipment)).toBe(200);
  });
  it('оборудование не выбрано — вычитать нечего', () => {
    expect(itemNetProfit(item({ price: 500, hasEquipment: true }), equipment)).toBe(500);
  });
  it('у товара прибыли для сотрудников нет', () => {
    expect(itemNetProfit(item({ isProduct: true }), equipment)).toBe(0);
  });
});

describe('разделение работы', () => {
  it('начальные строки: вся прибыль исполнителю позиции или основному мастеру', () => {
    expect(initialSplitEntries(item({ servicemanName: 'Петя' }), 'Вася', 80)).toEqual([
      { name: 'Петя', amount: 80 }, { name: '', amount: 0 },
    ]);
    expect(initialSplitEntries(item(), 'Вася', 80)[0]).toEqual({ name: 'Вася', amount: 80 });
  });
  it('сохранённое разделение открывается как есть', () => {
    const split = [{ name: 'A', amount: 10 }, { name: 'B', amount: 20 }];
    expect(initialSplitEntries(item({ servicemanSplit: split }), 'Вася', 80)).toBe(split);
  });
  it('нужно минимум два сотрудника с именем', () => {
    expect(validateSplit([{ name: 'A', amount: 10 }, { name: '', amount: 5 }], 100)).toEqual({ ok: false, reason: 'tooFew' });
  });
  it('сумма не больше чистой прибыли (допуск копейка)', () => {
    expect(validateSplit([{ name: 'A', amount: 60 }, { name: 'B', amount: 50 }], 100))
      .toEqual({ ok: false, reason: 'exceeds', total: 110 });
    expect(validateSplit([{ name: 'A', amount: 50 }, { name: 'B', amount: 50.005 }], 100).ok).toBe(true);
  });
  it('пустые строки отбрасываются', () => {
    const r = validateSplit([{ name: 'A', amount: 10 }, { name: '', amount: 0 }, { name: 'B', amount: 20 }], 100);
    expect(r).toEqual({ ok: true, entries: [{ name: 'A', amount: 10 }, { name: 'B', amount: 20 }] });
  });
});

describe('предоплата', () => {
  it('черновик из BYN-предоплаты', () => {
    expect(prepayDraftFromItem(item({ prepaidAmount: 40, prepaidByCard: true }))).toEqual({
      currency: 'BYN', amount: 40, byCard: true, currencyAmount: 0, rate: null,
    });
  });
  it('черновик из валютной предоплаты: сумма BYN не переносится', () => {
    expect(prepayDraftFromItem(item({ prepaidAmount: 290, prepaidCurrency: 'USD', prepaidCurrencyAmount: 100, prepaidRate: 2.9 })))
      .toEqual({ currency: 'USD', amount: 0, byCard: false, currencyAmount: 100, rate: 2.9 });
  });
  it('BYN: сумма и способ оплаты, валютные поля сброшены', () => {
    expect(prepaidFromDraft({ currency: 'BYN', amount: 50, byCard: true, currencyAmount: 10, rate: 3 })).toEqual({
      prepaidAmount: 50, prepaidByCard: true, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null,
    });
  });
  it('валюта пересчитывается по курсу, только наличные', () => {
    expect(prepaidFromDraft({ currency: 'EUR', amount: 0, byCard: true, currencyAmount: 100, rate: 3.456 })).toEqual({
      prepaidAmount: 345.6, prepaidByCard: false, prepaidCurrency: 'EUR', prepaidCurrencyAmount: 100, prepaidRate: 3.456,
    });
  });
  it('валюта без курса — ошибка (null)', () => {
    expect(prepaidFromDraft({ currency: 'USD', amount: 0, byCard: false, currencyAmount: 100, rate: null })).toBeNull();
  });
  it('нулевая сумма в валюте снимает предоплату', () => {
    expect(prepaidFromDraft({ currency: 'USD', amount: 0, byCard: false, currencyAmount: 0, rate: null })).toEqual({
      prepaidAmount: 0, prepaidByCard: false, prepaidCurrency: null, prepaidCurrencyAmount: null, prepaidRate: null,
    });
  });
});
