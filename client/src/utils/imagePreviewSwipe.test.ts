import { describe, expect, it } from 'vitest';
import { maskOpacity, swipeAction } from './imagePreviewSwipe';

describe('swipeAction', () => {
  it('влево — следующее фото, вправо — предыдущее', () => {
    expect(swipeAction({ dx: -80, dy: 10, dt: 300 })).toBe('next');
    expect(swipeAction({ dx: 80, dy: -10, dt: 300 })).toBe('prev');
  });

  it('вниз и вверх — закрыть', () => {
    expect(swipeAction({ dx: 20, dy: 120, dt: 300 })).toBe('close');
    expect(swipeAction({ dx: -20, dy: -120, dt: 300 })).toBe('close');
  });

  it('короткое медленное движение ничего не делает', () => {
    expect(swipeAction({ dx: -40, dy: 0, dt: 400 })).toBeNull();
    expect(swipeAction({ dx: 0, dy: 60, dt: 400 })).toBeNull();
    expect(swipeAction({ dx: 0, dy: 0, dt: 100 })).toBeNull();
  });

  it('быстрый взмах засчитывается с половины расстояния', () => {
    expect(swipeAction({ dx: -35, dy: 0, dt: 50 })).toBe('next');
    expect(swipeAction({ dx: 0, dy: 50, dt: 60 })).toBe('close');
  });

  it('направление — по преобладающей оси', () => {
    expect(swipeAction({ dx: -70, dy: 100, dt: 300 })).toBe('close');
    expect(swipeAction({ dx: -100, dy: 95, dt: 300 })).toBe('next');
  });
});

describe('maskOpacity', () => {
  it('фон светлеет по мере движения, но не до конца', () => {
    expect(maskOpacity(0)).toBe(1);
    expect(maskOpacity(-150)).toBeCloseTo(0.5);
    expect(maskOpacity(1000)).toBeCloseTo(0.3);
  });
});
