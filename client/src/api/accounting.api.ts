import http from './http';
import { CashTransaction, CapitalTransaction, Currency, CurrencyRates } from '@/types';

export interface CashMonthData {
  income: CashTransaction[];
  incomeRs: CashTransaction[];
  expenses: CashTransaction[];
}

export interface SalaryRecordItem {
  serviceName: string;
  netProfit: number;
  payment: number;
}

export interface SalaryRecord {
  recordId: string;
  clientName: string;
  carInfo: string;
  scheduledAt: string;
  closedAt: string;
  salaryDate?: string | null;
  items: SalaryRecordItem[];
  totalNetProfit: number;
  totalPayment: number;
}

export interface SalaryAdjustment {
  id: string;
  servicemanName: string;
  type: 'FINE' | 'BONUS';
  amount: number;
  reason: string;
  year: number;
  month: number;
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  type: 'ADVANCE' | 'FINAL';
  // Вся выплата = наличные (расход в кассе) + карта
  amount: number;
  cashAmount: number;
  cardAmount: number;
  date: string;
  person: string | null;
  createdAt: string;
}

export interface SalaryData {
  servicemanName: string;
  profitPercent: number;
  periodFrom: string;
  periodTo: string;
  records: SalaryRecord[];
  totalNetProfit: number;
  totalPayment: number;
  // Оклад за период
  baseSalary: number;
  adjustments: SalaryAdjustment[];
  adjustedTotal: number;
  payments: SalaryPayment[];
  paidTotal: number;
  // Остаток к выплате; отрицательный — переплата
  remaining: number;
}

export const accountingApi = {
  getCash: (year: number, month: number) =>
    http.get<{ data: CashMonthData }>('/accounting/cash', { params: { year, month } }).then(r => r.data.data),

  getBalance: () =>
    http.get<{ data: { balance: number } }>('/accounting/balance').then(r => r.data.data.balance),

  createExpense: (data: {
    date: string;
    description: string;
    amount: number;
    person: string;
    founderSalary?: { year: number; month: number; person: string };
    // Название категории затрат; новая создаётся на сервере
    expenseCategory?: string | null;
  }) =>
    http.post<{ data: CashTransaction }>('/accounting/expense', data).then(r => r.data.data),

  createManualIncome: (data: { date: string; description: string; amount: number; person: string }) =>
    http.post<{ data: CashTransaction }>('/accounting/manual-income', data).then(r => r.data.data),

  getCapital: () =>
    http.get<{ data: { deposits: CapitalTransaction[]; withdrawals: CapitalTransaction[] } }>('/accounting/capital').then(r => r.data.data),

  getCapitalBalance: () =>
    http.get<{ data: { byn: number; usd: number; eur: number } }>('/accounting/capital/balance').then(r => r.data.data),

  createDeposit: (data: { date: string; amount: number; currency: Currency }) =>
    http.post<{ data: CapitalTransaction }>('/accounting/capital/deposit', data).then(r => r.data.data),

  createWithdrawal: (data: { date: string; amount: number; currency: Currency; description?: string; person: string }) =>
    http.post<{ data: CapitalTransaction }>('/accounting/capital/withdrawal', data).then(r => r.data.data),

  /** Расход из кассы, который пополняет капитал в BYN или в купленной на него валюте */
  createCapitalTransfer: (data: {
    date: string; amountByn: number; currency: Currency; currencyAmount?: number; person: string; description?: string;
  }) =>
    http.post<{ data: CashTransaction }>('/accounting/capital/transfer', data).then(r => r.data.data),

  getRates: (refresh = false) =>
    http.get<{ data: CurrencyRates }>('/accounting/rates', { params: refresh ? { refresh: true } : {} }).then(r => r.data.data),

  getSalary: (servicemanName: string, year: number, month: number) =>
    http.get<{ data: SalaryData }>('/accounting/salary', { params: { servicemanName, year, month } }).then(r => r.data.data),

  getSalaryHistory: (servicemanName: string) =>
    http.get<{ data: SalaryHistoryItem[] }>('/accounting/salary/history', { params: { servicemanName } }).then(r => r.data.data),

  getMonthlyRevenue: () =>
    http.get<{ data: MonthlyRevenueItem[] }>('/accounting/monthly-revenue').then(r => r.data.data),

  setMonthlyRevenue: (year: number, month: number, amount: number) =>
    http.post<{ data: MonthlyRevenueItem }>('/accounting/monthly-revenue', { year, month, amount }).then(r => r.data.data),

  getMonthlyRecordCount: () =>
    http.get<{ data: MonthlyRecordCountItem[] }>('/accounting/monthly-record-count').then(r => r.data.data),

  setMonthlyRecordCount: (year: number, month: number, count: number) =>
    http.post<{ data: MonthlyRecordCountItem }>('/accounting/monthly-record-count', { year, month, count }).then(r => r.data.data),

  updateCashTransaction: (id: string, data: { date?: string; amount?: number; description?: string; person?: string; expenseCategory?: string | null }) =>
    http.patch<{ data: CashTransaction }>(`/accounting/cash/${id}`, data).then(r => r.data.data),

  deleteCashTransaction: (id: string) =>
    http.delete(`/accounting/cash/${id}`),

  createAdjustment: (data: { servicemanName: string; type: 'FINE' | 'BONUS'; amount: number; reason: string; year: number; month: number }) =>
    http.post<{ data: SalaryAdjustment }>('/accounting/salary-adjustments', data).then(r => r.data.data),

  deleteAdjustment: (id: string) =>
    http.delete(`/accounting/salary-adjustments/${id}`),

  createSalaryPayment: (data: {
    servicemanName: string; year: number; month: number; amount: number; cardAmount: number; date: string; person?: string;
  }) =>
    http.post<{ data: SalaryPayment }>('/accounting/salary-payments', data).then(r => r.data.data),

  deleteSalaryPayment: (id: string) =>
    http.delete(`/accounting/salary-payments/${id}`),

  getFounderSalaries: () =>
    http.get<{ data: FounderSalaryRecord[] }>('/accounting/founder-salaries').then(r => r.data.data),

  getDebts: (archived: boolean) =>
    http.get<{ data: Debt[] }>('/accounting/debts', { params: { archived } }).then(r => r.data.data),

  createDebt: (data: { description: string; amount: number; currency: Currency; direction: DebtDirection; expenseCategory?: string }) =>
    http.post<{ data: Debt }>('/accounting/debts', data).then(r => r.data.data),

  updateDebt: (id: string, data: { description?: string; amount?: number; expenseCategory?: string }) =>
    http.patch<{ data: Debt }>(`/accounting/debts/${id}`, data).then(r => r.data.data),

  deleteDebt: (id: string) =>
    http.delete(`/accounting/debts/${id}`),

  /** amount — в валюте currency; rate — BYN за единицу валюты, если нужна конвертация */
  payDebt: (id: string, data: { amount: number; currency: Currency; rate?: number }) =>
    http.post<{ data: Debt }>(`/accounting/debts/${id}/payments`, data).then(r => r.data.data),
};

export type DebtDirection = 'WE_OWE' | 'OWED_TO_US';

export type VdfOrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

export interface VdfOrderItem {
  title: string;
  options: string;
  sku: string | null;
  qty: number;
  price: number;
  sum: number;
}

/** Оплата заказа vdf.by — расход в кассе */
export interface VdfOrderPayment {
  id: string;
  paidByName: string | null;
  createdAt: string;
  cashTransaction: { id: string; amount: number; date: string; person: string | null };
}

/** Заказ сотрудника из магазина vdf.by: исполнение (всё или частично) создаёт расход в кассе */
export interface VdfOrder {
  id: string;
  shopOrderId: number;
  status: VdfOrderStatus;
  employeeName: string;
  employeePhone: string | null;
  items: VdfOrderItem[];
  shopTotal: number;
  amount: number;
  amountEdited: boolean;
  completedAt: string;
  shopCancelled: boolean;
  executedAt: string | null;
  executedByName: string | null;
  /** В списках заказов; удалённый из кассы расход оплатой не считается */
  payments?: VdfOrderPayment[];
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
}

export const vdfOrdersApi = {
  list: (status: VdfOrderStatus) =>
    http.get<{ data: VdfOrder[] }>('/accounting/vdf-orders', { params: { status } }).then(r => r.data.data),

  pendingCount: () =>
    http.get<{ data: { count: number } }>('/accounting/vdf-orders/pending-count').then(r => r.data.data.count),

  updateAmount: (id: string, amount: number) =>
    http.patch<{ data: VdfOrder }>(`/accounting/vdf-orders/${id}`, { amount }).then(r => r.data.data),

  /** Без суммы — на весь остаток */
  execute: (id: string, person: string, amount?: number) =>
    http.post<{ data: VdfOrder }>(`/accounting/vdf-orders/${id}/execute`, { person, amount }).then(r => r.data.data),

  cancel: (id: string, reason?: string) =>
    http.post<{ data: VdfOrder }>(`/accounting/vdf-orders/${id}/cancel`, { reason }).then(r => r.data.data),

  restore: (id: string) =>
    http.post<{ data: VdfOrder }>(`/accounting/vdf-orders/${id}/restore`).then(r => r.data.data),
};
export type DebtStatus = 'ACTIVE' | 'SETTLED';

export interface DebtPayment {
  id: string;
  /** На сколько уменьшился долг — в валюте долга */
  amount: number;
  paidCurrency: Currency;
  paidAmount: number | null;
  rate: number | null;
  paidAt: string;
  cashTransactionId: string | null;
  capitalTransactionId: string | null;
}

export interface Debt {
  id: string;
  description: string;
  currency: Currency;
  initialAmount: number;
  remainingAmount: number;
  direction: DebtDirection;
  status: DebtStatus;
  createdAt: string;
  settledAt: string | null;
  payments: DebtPayment[];
  /** Категория затрат — только у долгов «мы должны» */
  expenseCategory?: { id: string; name: string } | null;
}

export interface MonthlyRevenueItem {
  key: string;
  year: number;
  month: number;
  label: string;
  labelShort: string;
  amount: number;
  isOverride: boolean;
}

export interface MonthlyRecordCountItem {
  key: string;
  year: number;
  month: number;
  label: string;
  labelShort: string;
  count: number;
  isOverride: boolean;
}

export interface SalaryHistoryItem {
  year: number;
  month: number;
  label: string;
  adjustedTotal: number;
  recordCount: number;
}

export interface FounderSalaryRecord {
  id: string;
  year: number;
  month: number;
  person: string;
  amount: number;
  cashTransactionId: string | null;
  createdAt: string;
}
