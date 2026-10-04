import { describe, expect, it } from 'vitest';
import type { Record } from '@/types';
import { recordUnpaid } from './records';

const rec = (items: Array<{ price: number; quantity: number; prepaidAmount?: number }>, finalPrice?: number) =>
  ({ items, deal: finalPrice === undefined ? null : { finalPrice } } as unknown as Record);

describe('recordUnpaid', () => {
  it('сумма позиций с учётом количества', () => {
    expect(recordUnpaid(rec([{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }]))).toBe(250);
  });

  it('вычитает предоплату', () => {
    expect(recordUnpaid(rec([{ price: 100, quantity: 1, prepaidAmount: 30 }]))).toBe(70);
  });

  it('не уходит в минус при переплате', () => {
    expect(recordUnpaid(rec([{ price: 100, quantity: 1, prepaidAmount: 150 }]))).toBe(0);
  });

  it('у закрытой — итог сделки, предоплату повторно не вычитаем', () => {
    expect(recordUnpaid(rec([{ price: 100, quantity: 1, prepaidAmount: 30 }], 120))).toBe(120);
  });
});
