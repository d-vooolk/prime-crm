import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, formatPrice, roundMoney, toByn } from './formatters';

// Intl для ru-RU разделяет разряды неразрывным пробелом — приводим к обычному
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatPrice', () => {
  it('целые рубли с разделителем разрядов', () => {
    expect(plain(formatPrice(1234567))).toBe('1 234 567 р.');
  });

  it('копейки округляет', () => {
    expect(plain(formatPrice(99.6))).toBe('100 р.');
  });
});

describe('formatMoney', () => {
  it('рубли — до копеек', () => {
    expect(plain(formatMoney(1500.5))).toBe('1 500,5 р.');
  });

  it('валюта — со знаком', () => {
    expect(plain(formatMoney(100, 'USD'))).toBe('100 $');
    expect(plain(formatMoney(12.5, 'EUR'))).toBe('12,5 €');
  });
});

describe('formatDuration', () => {
  it.each([
    [45, '45 мин'],
    [60, '1 ч'],
    [90, '1 ч 30 мин'],
    [0, '0 мин'],
  ])('%i минут → %s', (min, text) => {
    expect(formatDuration(min)).toBe(text);
  });
});

describe('деньги', () => {
  it('toByn считает по курсу до копеек', () => {
    expect(toByn(100, 3.2567)).toBe(325.67);
    expect(toByn(33.33, 2.95)).toBe(98.32);
  });

  it('roundMoney убирает погрешность Float', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(12.3456)).toBe(12.35);
  });
});
