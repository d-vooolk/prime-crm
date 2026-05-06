import http from './http';
import { CashTransaction, CapitalTransaction } from '@/types';

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

export interface SalaryData {
  servicemanName: string;
  profitPercent: number;
  periodFrom: string;
  periodTo: string;
  records: SalaryRecord[];
  totalNetProfit: number;
  totalPayment: number;
  adjustments: SalaryAdjustment[];
  adjustedTotal: number;
}

export const accountingApi = {
  getCash: (year: number, month: number) =>
    http.get<{ data: CashMonthData }>('/accounting/cash', { params: { year, month } }).then(r => r.data.data),

  getBalance: () =>
    http.get<{ data: { balance: number } }>('/accounting/balance').then(r => r.data.data.balance),

  createExpense: (data: { date: string; description: string; amount: number; person: string }) =>
    http.post<{ data: CashTransaction }>('/accounting/expense', data).then(r => r.data.data),

  createManualIncome: (data: { date: string; description: string; amount: number; person: string }) =>
    http.post<{ data: CashTransaction }>('/accounting/manual-income', data).then(r => r.data.data),

  getCapital: () =>
    http.get<{ data: { deposits: CapitalTransaction[]; withdrawals: CapitalTransaction[] } }>('/accounting/capital').then(r => r.data.data),

  getCapitalBalance: () =>
    http.get<{ data: { byn: number; usd: number } }>('/accounting/capital/balance').then(r => r.data.data),

  createDeposit: (data: { date: string; amount: number; currency: 'BYN' | 'USD' }) =>
    http.post<{ data: CapitalTransaction }>('/accounting/capital/deposit', data).then(r => r.data.data),

  createWithdrawal: (data: { date: string; amount: number; currency: 'BYN' | 'USD'; description?: string; person: string }) =>
    http.post<{ data: CapitalTransaction }>('/accounting/capital/withdrawal', data).then(r => r.data.data),

  getSalary: (servicemanName: string, year: number, month: number) =>
    http.get<{ data: SalaryData }>('/accounting/salary', { params: { servicemanName, year, month } }).then(r => r.data.data),

  getSalaryHistory: (servicemanName: string) =>
    http.get<{ data: SalaryHistoryItem[] }>('/accounting/salary/history', { params: { servicemanName } }).then(r => r.data.data),

  getMonthlyRevenue: () =>
    http.get<{ data: MonthlyRevenueItem[] }>('/accounting/monthly-revenue').then(r => r.data.data),

  setMonthlyRevenue: (year: number, month: number, amount: number) =>
    http.post<{ data: MonthlyRevenueItem }>('/accounting/monthly-revenue', { year, month, amount }).then(r => r.data.data),

  updateCashTransaction: (id: string, data: { date?: string; amount?: number; description?: string; person?: string }) =>
    http.patch<{ data: CashTransaction }>(`/accounting/cash/${id}`, data).then(r => r.data.data),

  deleteCashTransaction: (id: string) =>
    http.delete(`/accounting/cash/${id}`),

  createAdjustment: (data: { servicemanName: string; type: 'FINE' | 'BONUS'; amount: number; reason: string; year: number; month: number }) =>
    http.post<{ data: SalaryAdjustment }>('/accounting/salary-adjustments', data).then(r => r.data.data),

  deleteAdjustment: (id: string) =>
    http.delete(`/accounting/salary-adjustments/${id}`),

  getFounderSalaries: () =>
    http.get<{ data: FounderSalaryRecord[] }>('/accounting/founder-salaries').then(r => r.data.data),

  createFounderSalary: (data: { year: number; month: number; person: string; amount: number }) =>
    http.post<{ data: FounderSalaryRecord }>('/accounting/founder-salaries', data).then(r => r.data.data),
};

export interface MonthlyRevenueItem {
  key: string;
  year: number;
  month: number;
  label: string;
  labelShort: string;
  amount: number;
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
  createdAt: string;
}
