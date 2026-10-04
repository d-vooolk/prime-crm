import React from 'react';
import dayjs from 'dayjs';
import { formatPrice } from '@/utils/formatters';
import { ChartRow, ChartSeries } from '../utils';
import styles from './ExpensesTooltip.module.scss';

interface Props {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  series: ChartSeries[];
}

/** Подсказка столбца графика расходов: группы месяца по убыванию суммы и итог */
export const ExpensesTooltip: React.FC<Props> = ({ active, payload, series }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const rows = series
    .map(s => ({ ...s, value: Number(row[s.key] ?? 0) }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{dayjs(`${row.month}-01`).format('MMMM YYYY')}</div>
      {rows.map(s => (
        <div key={s.key} className={styles.tooltipRow}>
          <svg className={styles.lineKey} viewBox="0 0 12 2" aria-hidden><line x1="0" y1="1" x2="12" y2="1" stroke={s.color} strokeWidth="2" /></svg>
          <strong className={styles.tooltipValue}>{formatPrice(s.value)}</strong>
          <span className={styles.tooltipName}>{s.name}</span>
        </div>
      ))}
      <div className={styles.tooltipTotal}>
        Итого: <strong>{formatPrice(row.total)}</strong>
      </div>
    </div>
  );
};
