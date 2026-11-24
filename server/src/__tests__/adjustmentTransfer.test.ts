import { describe, expect, it } from 'vitest';
import { transferredAdjustmentMonth } from '../services/salaryRates';

const fresh = { year: 2026, month: 11, originYear: null, originMonth: null };

describe('transferredAdjustmentMonth', () => {
  it('первый перенос запоминает исходный месяц', () => {
    expect(transferredAdjustmentMonth(fresh, { year: 2026, month: 12 }))
      .toEqual({ year: 2026, month: 12, originYear: 2026, originMonth: 11 });
  });

  it('повторный перенос сохраняет самый первый месяц', () => {
    const moved = { year: 2026, month: 12, originYear: 2026, originMonth: 11 };
    expect(transferredAdjustmentMonth(moved, { year: 2027, month: 1 }))
      .toEqual({ year: 2027, month: 1, originYear: 2026, originMonth: 11 });
  });

  it('сброс возвращает в исходный месяц', () => {
    const moved = { year: 2027, month: 1, originYear: 2026, originMonth: 11 };
    expect(transferredAdjustmentMonth(moved, null))
      .toEqual({ year: 2026, month: 11, originYear: null, originMonth: null });
  });

  it('перенос обратно в исходный месяц — то же, что сброс', () => {
    const moved = { year: 2027, month: 1, originYear: 2026, originMonth: 11 };
    expect(transferredAdjustmentMonth(moved, { year: 2026, month: 11 }))
      .toEqual({ year: 2026, month: 11, originYear: null, originMonth: null });
  });

  it('сброс без переноса ничего не меняет', () => {
    expect(transferredAdjustmentMonth(fresh, null)).toEqual(fresh);
  });
});
