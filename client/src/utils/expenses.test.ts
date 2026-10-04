import { describe, expect, it } from 'vitest';
import type { CashTransaction } from '@/types';
import { canHaveExpenseCategory, isSystemExpense } from './expenses';

const tx = (patch: Partial<CashTransaction>): CashTransaction => ({ type: 'EXPENSE', ...patch } as CashTransaction);

describe('isSystemExpense', () => {
  it('обычный расход — не системный', () => {
    expect(isSystemExpense(tx({}))).toBe(false);
  });

  it.each(['founderSalary', 'salaryPayment', 'capitalTransfer', 'debtPayment'] as const)('%s — системный', key => {
    expect(isSystemExpense(tx({ [key]: { id: 'x' } }))).toBe(true);
  });
});

describe('canHaveExpenseCategory', () => {
  it('только обычный расход кассы', () => {
    expect(canHaveExpenseCategory(tx({}))).toBe(true);
    expect(canHaveExpenseCategory(tx({ type: 'INCOME' }))).toBe(false);
    expect(canHaveExpenseCategory(tx({ salaryPayment: { id: 'x' } }))).toBe(false);
  });
});
