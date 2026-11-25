import { describe, expect, it } from 'vitest';
import { messengerPhone, telegramHref, viberHref } from './messengers';

describe('messengerPhone', () => {
  it('убирает маску', () => {
    expect(messengerPhone('+375 (29) 123-45-67')).toBe('375291234567');
  });

  it('дополняет белорусский номер кодом страны', () => {
    expect(messengerPhone('80291234567')).toBe('375291234567');
    expect(messengerPhone('29 123 45 67')).toBe('375291234567');
  });

  it('оставляет номер другой страны как есть', () => {
    expect(messengerPhone('+7 916 123-45-67')).toBe('79161234567');
  });

  it('неполный или пустой номер — null', () => {
    expect(messengerPhone('+375 (29)')).toBeNull();
    expect(messengerPhone('')).toBeNull();
    expect(messengerPhone(null)).toBeNull();
  });
});

describe('ссылки', () => {
  it('Telegram и Viber с плюсом перед номером', () => {
    expect(telegramHref('375291234567')).toBe('https://t.me/+375291234567');
    expect(viberHref('375291234567')).toBe('viber://chat?number=%2B375291234567');
  });
});
