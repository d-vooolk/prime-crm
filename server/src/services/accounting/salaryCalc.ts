/**
 * Чистые расчёты зарплаты — без базы, чтобы их можно было проверить тестами.
 * Расчётный период месяца M: с 25-го числа месяца M−1 по 24-е число месяца M.
 */

export interface SplitEntry { name: string; amount: number }

/** Границы расчётного периода: [from; to) */
export function salaryPeriod(year: number, month: number) {
  return {
    from: new Date(year, month - 2, 25),
    to: new Date(year, month - 1, 25),
  };
}

/**
 * Доля сотрудника в позиции записи (сумма, с которой считается процент).
 * Работа поделена между мастерами — его часть из дележа; иначе вся прибыль позиции,
 * если исполнитель — он. null — сотрудник эту позицию не делал.
 */
export function servicemanShare(
  item: { servicemanName: string | null; servicemanSplit: unknown; netProfit: number | null },
  name: string,
): number | null {
  if (!item.servicemanSplit) {
    return item.servicemanName === name ? (item.netProfit ?? 0) : null;
  }
  const split = item.servicemanSplit as SplitEntry[];
  const entry = Array.isArray(split) ? split.find(s => s.name === name) : undefined;
  return entry ? entry.amount : null;
}

/** Процент сотрудника: свой у услуги, иначе у категории, иначе личный процент сотрудника */
export function effectivePercent(
  service: { customPercent: number | null; category?: { customPercent: number | null } | null },
  profitPercent: number,
): number {
  return service.customPercent ?? service.category?.customPercent ?? profitPercent;
}

/** Выплата с доли по проценту, с округлением до копейки */
export const paymentFor = (share: number, percent: number) => Math.round(share * percent) / 100;

/** Итог за месяц: процент с работ + оклад + премии − штрафы */
export function adjustedTotal(
  workPayment: number,
  baseSalary: number,
  adjustments: Array<{ type: 'FINE' | 'BONUS'; amount: number }>,
): number {
  const bonus = adjustments.filter(a => a.type === 'BONUS').reduce((s, a) => s + a.amount, 0);
  const fine = adjustments.filter(a => a.type === 'FINE').reduce((s, a) => s + a.amount, 0);
  return workPayment + baseSalary + bonus - fine;
}

/** Выплата целиком закрывает остаток — расчёт, иначе аванс */
export const paymentType = (amount: number, remaining: number): 'ADVANCE' | 'FINAL' =>
  amount >= remaining ? 'FINAL' : 'ADVANCE';
