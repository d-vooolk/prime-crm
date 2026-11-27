// Общее для бухгалтерии: зарезервированные описания системных расходов и округление
import { Prisma } from '@prisma/client';

/**
 * Приходы, из которых складывается выручка. Погашения долгов «нам должны» идут транзитом через кассу
 * (и валютой — дальше в капитал), но выручкой месяца не считаются: платят обычно не клиенты
 */
export const REVENUE_INCOME_WHERE = {
  type: { in: ['INCOME', 'MANUAL_INCOME', 'INCOME_RS'] },
  debtPayment: { is: null },
} satisfies Prisma.CashTransactionWhereInput;

// Описание расхода-ЗП учредителя. Такие расходы создаются только через свитч
// «ЗП учредителей», иначе сумма не попадёт в таблицу учредителей
export const FOUNDER_SALARY_PREFIX = 'ЗП учредителя';

export const isFounderSalaryDescription = (description?: string | null) =>
  !!description && description.trim().toLowerCase().startsWith(FOUNDER_SALARY_PREFIX.toLowerCase());

export const FOUNDER_SALARY_MANUAL_ERROR =
  `Описание «${FOUNDER_SALARY_PREFIX} …» зарезервировано: включите свитч «ЗП учредителей»`;

// Описание расхода-выплаты ЗП сотруднику. Такие расходы создаются только кнопкой
// «Выплатить ЗП» в расчёте зарплаты, иначе выплата не попадёт в остаток сотрудника
export const EMPLOYEE_SALARY_PREFIX = 'ЗП сотрудника';

export const isEmployeeSalaryDescription = (description?: string | null) =>
  !!description && description.trim().toLowerCase().startsWith(EMPLOYEE_SALARY_PREFIX.toLowerCase());

export const EMPLOYEE_SALARY_MANUAL_ERROR =
  `Описание «${EMPLOYEE_SALARY_PREFIX} …» зарезервировано: выплатите ЗП из расчёта зарплаты`;

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// Копейки после сложения/вычитания — округляем, чтобы остаток 0.0000001 не считался долгом
export const roundMoney = (v: number) => Math.round(v * 100) / 100;
