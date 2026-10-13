import { describe, expect, it } from 'vitest';
import { telHref, toCrmPhone } from './leads.utils';

describe('toCrmPhone', () => {
  it('оставляет номер в маске сайта как есть', () => {
    expect(toCrmPhone('+375 (29) 123-45-67')).toBe('+375 (29) 123-45-67');
  });

  it('приводит номер без маски к формату записи', () => {
    expect(toCrmPhone('+375291234567')).toBe('+375 (29) 123-45-67');
    expect(toCrmPhone('80291234567')).toBe('+375 (29) 123-45-67');
    expect(toCrmPhone('29 123 45 67')).toBe('+375 (29) 123-45-67');
  });

  it('чужой или неполный номер не трогает', () => {
    expect(toCrmPhone(' +7 916 123-45-67 ')).toBe('+7 916 123-45-67');
    expect(toCrmPhone('12345')).toBe('12345');
  });
});

describe('telHref', () => {
  it('оставляет только цифры и плюс', () => {
    expect(telHref('+375 (29) 123-45-67')).toBe('tel:+375291234567');
  });
});
