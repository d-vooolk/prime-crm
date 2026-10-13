import { describe, expect, it } from 'vitest';
import { autoScale, effectiveScale } from './uiScale';

describe('autoScale', () => {
  it('2K и шире — без изменений', () => {
    expect(autoScale(2560)).toBe(1);
    expect(autoScale(3840)).toBe(1);
  });

  it('1920 — как на 2K-мониторе', () => {
    expect(autoScale(1920)).toBe(0.75);
  });

  it('телефоны, планшеты и ноутбуки не трогает', () => {
    expect(autoScale(390)).toBe(1);
    expect(autoScale(1366)).toBe(1);
    expect(autoScale(1536)).toBe(1);
  });

  it('не мельче 65%', () => {
    expect(autoScale(1700)).toBe(0.66);
    expect(autoScale(1600)).toBe(1);
  });
});

describe('effectiveScale', () => {
  it('ручной выбор важнее ширины монитора', () => {
    expect(effectiveScale(0.65, 2560)).toBe(0.65);
    expect(effectiveScale('auto', 1920)).toBe(0.75);
  });
});
