import React from 'react';
import cn from 'classnames';
import type { Tone } from '../useChartColors';
import styles from './ChartTooltip.module.scss';

interface Props {
  label: React.ReactNode;
  /** Подпись значения: «Выручка», «Записей» */
  name: string;
  value: React.ReactNode;
  tone: Tone;
  /** Дополнительная строка мелким шрифтом */
  hint?: React.ReactNode;
}

/** Всплывающая подсказка графиков дашборда: месяц и одно значение с меткой цвета серии */
export const ChartTooltip: React.FC<Props> = ({ label, name, value, tone, hint }) => (
  <div className={styles.tooltip}>
    <div className={styles.label}>{label}</div>
    <div className={styles.row}>
      <span className={cn(styles.dot, styles[tone])} />
      {name}: <strong className={styles.value}>{value}</strong>
    </div>
    {hint && <div className={styles.muted}>{hint}</div>}
  </div>
);
