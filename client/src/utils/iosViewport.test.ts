import { describe, it, expect } from 'vitest';
import { opensKeyboard, isViewportShifted } from './iosViewport';

describe('opensKeyboard', () => {
  it('текстовые поля открывают клавиатуру', () => {
    expect(opensKeyboard({ tag: 'INPUT', type: 'text' })).toBe(true);
    expect(opensKeyboard({ tag: 'INPUT', type: 'tel' })).toBe(true);
    expect(opensKeyboard({ tag: 'TEXTAREA' })).toBe(true);
    expect(opensKeyboard({ tag: 'DIV', contentEditable: true })).toBe(true);
  });

  it('выпадающий список antd без поиска (input только для чтения) — не поле ввода', () => {
    expect(opensKeyboard({ tag: 'INPUT', type: 'search', readOnly: true })).toBe(false);
  });

  it('кнопки, флажки и прочие элементы клавиатуру не открывают', () => {
    expect(opensKeyboard({ tag: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(opensKeyboard({ tag: 'BUTTON' })).toBe(false);
    expect(opensKeyboard({ tag: 'BODY' })).toBe(false);
    expect(opensKeyboard(null)).toBe(false);
  });
});

describe('isViewportShifted', () => {
  const zero = { scrollX: 0, scrollY: 0, offsetTop: 0, offsetLeft: 0 };

  it('экран на месте', () => {
    expect(isViewportShifted(zero)).toBe(false);
    expect(isViewportShifted({ ...zero, offsetTop: 0.4 })).toBe(false);
  });

  it('застрявший visualViewport.offsetTop при нулевой прокрутке документа — сдвиг', () => {
    expect(isViewportShifted({ ...zero, offsetTop: 34 })).toBe(true);
  });

  it('прокрученный документ — сдвиг', () => {
    expect(isViewportShifted({ ...zero, scrollY: 120 })).toBe(true);
  });
});
