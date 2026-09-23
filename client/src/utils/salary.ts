import dayjs, { Dayjs } from 'dayjs';

/** Новый расчётный период зарплаты начинается 25-го числа */
export const SALARY_PERIOD_START_DAY = 25;

const MONTHS_IN_YEAR = 12;

/**
 * Расчётный месяц зарплаты, к которому относится указанная дата.
 * С 25-го числа начисления идут уже в следующий месяц — эта функция
 * единственный источник правила и для бухгалтерии, и для дашборда.
 */
export function effectiveSalaryMonth(today: Dayjs = dayjs()): Dayjs {
  return today.date() >= SALARY_PERIOD_START_DAY
    ? today.add(1, 'month').startOf('month')
    : today.startOf('month');
}

export interface SalaryMonthTotal {
  year: number;
  month: number;
  adjustedTotal: number;
}

export interface AverageAnnualSalary {
  average: number;
  monthsCount: number;
}

/**
 * Средний заработок за 12 месяцев, предшествующих текущему расчётному периоду.
 * Текущий (незакрытый) период не учитывается — иначе неполный месяц занижает среднее.
 * Делим на количество месяцев, по которым есть данные: у нового сотрудника
 * месяцы до найма отсутствуют в истории и не должны размывать среднее.
 */
export function averageAnnualSalary(
  history: SalaryMonthTotal[],
  today?: Dayjs,
): AverageAnnualSalary {
  const current = effectiveSalaryMonth(today);
  const monthIndex = (year: number, month: number) => year * MONTHS_IN_YEAR + (month - 1);
  const currentIndex = monthIndex(current.year(), current.month() + 1);
  const fromIndex = currentIndex - MONTHS_IN_YEAR;

  const inWindow = history.filter(h => {
    const i = monthIndex(h.year, h.month);
    return i >= fromIndex && i < currentIndex;
  });

  if (inWindow.length === 0) return { average: 0, monthsCount: 0 };

  const sum = inWindow.reduce((s, h) => s + h.adjustedTotal, 0);
  return { average: sum / inWindow.length, monthsCount: inWindow.length };
}

/** Шаг изменения суммы выплаты ЗП кнопками округления, р. */
export const SALARY_ROUND_STEP = 1;

/**
 * Кнопки округления суммы выплаты: дробная сумма округляется до целых рублей
 * в нужную сторону, целая — меняется на шаг (1 р.) за нажатие. Ниже нуля не уходит.
 */
export function roundSalaryAmount(amount: number, direction: 'up' | 'down'): number {
  // Сотые убираем до сравнения: 1234.9999999 из Float — это уже целые 1235
  const cents = Math.round(amount * 100);
  if (cents % 100 !== 0) {
    return direction === 'up' ? Math.ceil(cents / 100) : Math.floor(cents / 100);
  }
  const rubles = cents / 100;
  return direction === 'up' ? rubles + SALARY_ROUND_STEP : Math.max(0, rubles - SALARY_ROUND_STEP);
}
