import http from './http';
import { CashTransaction, CapitalTransaction } from '@/types';

export interface CashMonthData {
  income: CashTransaction[];
  incomeRs: CashTransaction[];
  expenses: CashTransaction[];
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

  createWithdrawal: (data: { date: string; amount: number; currency: 'BYN' | 'USD'; person: string }) =>
    http.post<{ data: CapitalTransaction }>('/accounting/capital/withdrawal', data).then(r => r.data.data),
};
