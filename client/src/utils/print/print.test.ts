import { describe, expect, it } from 'vitest';
import { numberToRussianWords } from './numberToWords';
import { escapeHtml, multiline } from './shared';
import { fillWarrantyTerm, NO_WARRANTY } from './warranty';
import { buildMemoHtml } from './actMemoLayout';

describe('numberToRussianWords', () => {
  it('ноль и простые числа', () => {
    expect(numberToRussianWords(0)).toBe('ноль');
    expect(numberToRussianWords(7)).toBe('семь');
    expect(numberToRussianWords(15)).toBe('пятнадцать');
    expect(numberToRussianWords(120)).toBe('сто двадцать');
  });

  it('тысячи — женского рода и с правильной формой', () => {
    expect(numberToRussianWords(1000)).toBe('одна тысяча');
    expect(numberToRussianWords(2000)).toBe('две тысячи');
    expect(numberToRussianWords(5000)).toBe('пять тысяч');
    expect(numberToRussianWords(11000)).toBe('одиннадцать тысяч');
    expect(numberToRussianWords(21345)).toBe('двадцать одна тысяча триста сорок пять');
  });

  it('дробная часть отбрасывается', () => {
    expect(numberToRussianWords(99.99)).toBe('девяносто девять');
  });
});

describe('escapeHtml / multiline', () => {
  it('экранирует спецсимволы', () => {
    expect(escapeHtml('<b>"A" & B</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;');
  });

  it('сохраняет переносы и обрезает края', () => {
    expect(multiline('  строка 1\nстрока <2>  ')).toBe('строка 1<br>строка &lt;2&gt;');
  });
});

describe('fillWarrantyTerm', () => {
  const text = 'Гарантия на шов - в течение ____ с даты акта';

  it('без выбранного срока оставляет прочерк', () => {
    expect(fillWarrantyTerm(text)).toBe(text);
  });

  it('подставляет срок в родительном падеже', () => {
    expect(fillWarrantyTerm(text, '1 месяц')).toBe('Гарантия на шов - в течение 1 месяца с даты акта');
    expect(fillWarrantyTerm(text, '1 год')).toBe('Гарантия на шов - в течение 1 года с даты акта');
  });

  it('незнакомый срок подставляет как есть', () => {
    expect(fillWarrantyTerm(text, '3 недели')).toBe('Гарантия на шов - в течение 3 недели с даты акта');
  });

  it('«Без гарантии» убирает «в течение»', () => {
    expect(fillWarrantyTerm(text, NO_WARRANTY)).toBe('Гарантия на шов - гарантия не предоставляется с даты акта');
  });

  it('прочерк без «в течение» тоже заменяется', () => {
    expect(fillWarrantyTerm('Срок: ____', '6 месяцев')).toBe('Срок: 6 месяцев');
  });
});

describe('buildMemoHtml', () => {
  it('заголовки, списки, абзацы и пустые строки', () => {
    const html = buildMemoHtml('Фары:\n- пункт 1\n- пункт <2>\n\nТекст');
    expect(html).toBe(
      '<div class="memo-title">Фары:</div><ul><li>пункт 1</li><li>пункт &lt;2&gt;</li></ul>'
      + '<div class="memo-gap"></div><p>Текст</p>',
    );
  });

  it('закрывает список в конце', () => {
    expect(buildMemoHtml('- один')).toBe('<ul><li>один</li></ul>');
  });
});
