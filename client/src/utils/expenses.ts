import { CashTransaction } from '@/types';

/**
 * Системный расход — создан не формой «Изъять средства»: ЗП учредителя, выплата ЗП сотруднику,
 * отчисление в капитал, погашение долга. Категория затрат таким не нужна.
 */
export const isSystemExpense = (tx: CashTransaction) =>
  !!(tx.founderSalary || tx.salaryPayment || tx.capitalTransfer || tx.debtPayment);

/** Категорию ставим только обычным расходам кассы. */
export const canHaveExpenseCategory = (tx: CashTransaction) =>
  tx.type === 'EXPENSE' && !isSystemExpense(tx);
