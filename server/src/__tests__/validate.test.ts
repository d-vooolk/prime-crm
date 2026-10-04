import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parse, money, positiveMoney, dateString, nullableText, optionalText } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { parseDay, nextDay } from '../utils/date';
import { isLowStock } from '../services/stock.service';

describe('схемы валидации', () => {
  it('money округляет до копеек и не пускает отрицательные', () => {
    expect(money().parse('12.345')).toBe(12.35);
    expect(() => money().parse(-1)).toThrow();
    expect(() => money().parse('abc')).toThrow();
    expect(() => positiveMoney().parse(0)).toThrow();
  });

  it('dateString отклоняет невалидную дату', () => {
    expect(dateString().parse('2026-10-04')).toBe('2026-10-04');
    expect(() => dateString().parse('не дата')).toThrow();
  });

  it('пустые строки: optionalText → undefined, nullableText → null', () => {
    expect(optionalText(10).parse('  ')).toBeUndefined();
    expect(nullableText(10).parse('')).toBeNull();
  });

  it('parse бросает AppError 400 с понятным сообщением', () => {
    const schema = z.object({ name: z.string().min(1, 'Укажите имя') });
    try {
      parse(schema, { name: '' });
      expect.fail('должно было упасть');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
      expect((e as AppError).message).toBe('Укажите имя');
    }
  });

  it('лишние поля отбрасываются (защита от подмены полей)', () => {
    const schema = z.object({ name: z.string() });
    expect(parse(schema, { name: 'x', nextDocumentNumber: 1, id: 'hack' })).toEqual({ name: 'x' });
  });
});

describe('даты', () => {
  it('parseDay даёт локальную полночь, а не UTC', () => {
    const d = parseDay('2026-09-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 1, 0]);
    expect(parseDay('2026-09-01T15:00:00.000Z').getDate()).toBe(1);
  });

  it('nextDay переходит через конец месяца', () => {
    expect(nextDay(parseDay('2026-01-31'))).toEqual(new Date(2026, 1, 1));
  });
});

describe('склад', () => {
  it('товар заканчивается на пороге и ниже; без порога — нет', () => {
    expect(isLowStock({ quantity: 5, minQuantity: 5 })).toBe(true);
    expect(isLowStock({ quantity: 4, minQuantity: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, minQuantity: 5 })).toBe(false);
    expect(isLowStock({ quantity: 0, minQuantity: null })).toBe(false);
  });
});
