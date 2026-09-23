import { prisma } from '../prisma/client';

/** Новый расчётный период зарплаты начинается 25-го числа (как на клиенте, utils/salary.ts) */
const SALARY_PERIOD_START_DAY = 25;

export interface SalaryMonth { year: number; month: number }

export interface SalaryRateLike extends SalaryMonth { amount: number }

const monthIndex = (m: SalaryMonth) => m.year * 12 + (m.month - 1);

/** Расчётный месяц, к которому относится дата: с 25-го числа — уже следующий */
export function effectiveSalaryMonth(date: Date = new Date()): SalaryMonth {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  if (date.getDate() >= SALARY_PERIOD_START_DAY) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { year, month };
}

/** Оклад, действующий в расчётном месяце: последняя запись истории, начавшаяся не позже него */
export function baseSalaryFor(rates: SalaryRateLike[], period: SalaryMonth): number {
  const target = monthIndex(period);
  let best: SalaryRateLike | null = null;
  for (const r of rates) {
    if (monthIndex(r) > target) continue;
    if (!best || monthIndex(r) > monthIndex(best)) best = r;
  }
  return best?.amount ?? 0;
}

/** Все расчётные месяцы с ненулевым окладом — от первой записи истории до текущего периода */
export function monthsWithBaseSalary(rates: SalaryRateLike[], until: SalaryMonth = effectiveSalaryMonth()): SalaryMonth[] {
  if (rates.length === 0) return [];
  const from = Math.min(...rates.map(monthIndex));
  const result: SalaryMonth[] = [];
  for (let i = from; i <= monthIndex(until); i++) {
    const m = { year: Math.floor(i / 12), month: (i % 12) + 1 };
    if (baseSalaryFor(rates, m) > 0) result.push(m);
  }
  return result;
}

/**
 * Смена оклада действует с текущего расчётного периода: прошлые месяцы
 * считаются по старому окладу. Повторная правка в том же периоде перезаписывает его.
 */
export async function setBaseSalary(servicemanId: string, amount: number) {
  const rates = await prisma.salaryRate.findMany({ where: { servicemanId } });
  const period = effectiveSalaryMonth();
  if (baseSalaryFor(rates, period) === amount) return;
  // Нулевой оклад без истории хранить незачем
  if (amount === 0 && rates.length === 0) return;
  await prisma.salaryRate.upsert({
    where: { servicemanId_year_month: { servicemanId, ...period } },
    update: { amount },
    create: { servicemanId, ...period, amount },
  });
}
