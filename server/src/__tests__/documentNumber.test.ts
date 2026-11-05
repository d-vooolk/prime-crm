import { describe, expect, it } from 'vitest';
import { randomDocumentNumber, uniqueDocumentNumber } from '../utils/documentNumber';

describe('номер документа', () => {
  it('префикс и 6 цифр, первая не ноль', () => {
    for (let i = 0; i < 200; i++) expect(randomDocumentNumber('ПА')).toMatch(/^ПА-[1-9]\d{5}$/);
  });

  it('пропускает занятые номера', async () => {
    const taken = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const n = await uniqueDocumentNumber('ПА', async x => taken.has(x));
      expect(taken.has(n)).toBe(false);
      taken.add(n);
    }
  });

  it('все номера заняты — ошибка, а не повтор', async () => {
    await expect(uniqueDocumentNumber('ПА', async () => true, 3)).rejects.toThrow();
  });
});
