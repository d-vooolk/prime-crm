import http from './http';

export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number | null;
  createdAt: string;
  // Сколько расходов с этой категорией
  usageCount: number;
}

export type ExpenseGroupKind = 'system' | 'category' | 'none';

export interface ExpenseAnalyticsItem {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  person: string | null;
}

export interface ExpenseAnalyticsGroup {
  // system:founderSalary | system:salaryPayment | system:capitalTransfer | system:debtPayment | category:<id> | none
  key: string;
  name: string;
  kind: ExpenseGroupKind;
  total: number;
  count: number;
  items: ExpenseAnalyticsItem[];
}

export interface ExpenseAnalyticsMonth {
  // YYYY-MM
  month: string;
  totals: Record<string, number>;
}

export interface ExpenseAnalytics {
  from: string;
  to: string;
  months: ExpenseAnalyticsMonth[];
  groups: ExpenseAnalyticsGroup[];
}

export const expensesApi = {
  getCategories: () =>
    http.get<{ data: ExpenseCategory[] }>('/expenses/categories').then(r => r.data.data),

  createCategory: (name: string) =>
    http.post<{ data: ExpenseCategory }>('/expenses/categories', { name }).then(r => r.data.data),

  updateCategory: (id: string, name: string) =>
    http.patch<{ data: ExpenseCategory }>(`/expenses/categories/${id}`, { name }).then(r => r.data.data),

  deleteCategory: (id: string) =>
    http.delete(`/expenses/categories/${id}`),

  // from/to — YYYY-MM, включительно
  getAnalytics: (from: string, to: string) =>
    http.get<{ data: ExpenseAnalytics }>('/expenses/analytics', { params: { from, to } }).then(r => r.data.data),
};
