import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import type { Car } from '@/types';
import { carLabel, getPeriodPresets, matchedCars, phoneDigits, telHref, yearsLabel } from './clientsHelpers';

const car = (id: string, extra: Partial<Car> = {}) =>
  ({ id, brand: 'BMW', model: 'X5', year: '2020', ...extra }) as Car;

describe('phoneDigits', () => {
  it('отрезает код страны из маски и оставляет только цифры', () => {
    expect(phoneDigits('+375 (29) 123-45-67')).toBe('291234567');
    expect(phoneDigits('+375 (2')).toBe('2');
  });

  it('пустая маска — пусто', () => {
    expect(phoneDigits('+375 (__) ___-__-__')).toBe('');
    expect(phoneDigits('')).toBe('');
  });
});

describe('carLabel / yearsLabel / telHref', () => {
  it('склеивает марку, модель и год без пустых частей', () => {
    expect(carLabel(car('1'))).toBe('BMW X5 2020');
    expect(carLabel(car('1', { year: '' }))).toBe('BMW X5');
  });

  it('годы поколения: без начала — пусто, без конца — «н.в.»', () => {
    expect(yearsLabel(null, 2010)).toBe('');
    expect(yearsLabel(2015, null)).toBe(' (2015–н.в.)');
    expect(yearsLabel(2015, 2020)).toBe(' (2015–2020)');
  });

  it('tel: оставляет цифры и плюс', () => {
    expect(telHref('+375 (29) 123-45-67')).toBe('tel:+375291234567');
  });
});

describe('matchedCars', () => {
  it('убирает повторы машин, сохраняя порядок', () => {
    const a = car('a');
    const b = car('b');
    const records = [a, b, a].map((c, i) => ({ id: String(i), scheduledAt: '', status: 'ACTIVE' as const, car: c }));
    expect(matchedCars({ matchedRecords: records }).map(c => c.id)).toEqual(['a', 'b']);
  });

  it('без подошедших записей — пустой список', () => {
    expect(matchedCars({})).toEqual([]);
  });
});

describe('getPeriodPresets', () => {
  it('«Прошлый месяц» — целиком предыдущий календарный месяц', () => {
    const presets = getPeriodPresets(dayjs('2026-03-15'));
    const prev = presets.find(p => p.label === 'Прошлый месяц')!;
    expect(prev.value[0].format('YYYY-MM-DD')).toBe('2026-02-01');
    expect(prev.value[1].format('YYYY-MM-DD')).toBe('2026-02-28');
  });
});
