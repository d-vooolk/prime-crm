import React from 'react';
import cn from 'classnames';
import styles from './ChartTooltip.module.scss';

export type ChartTone = 'blue' | 'green' | 'amber';

interface Props {
  label: React.ReactNode;
  /** Подпись значения: «Выручка», «Записей» */
  name: string;
  value: React.ReactNode;
  tone: ChartTone;
  /** Дополнительная строка мелким шрифтом */
  hint?: React.ReactNode;
}

/** Всплывающая подсказка графиков дашборда: месяц и одно значение цветом серии */
export const ChartTooltip: React.FC<Props> = ({ label, name, value, tone, hint }) => (
  <div className={styles.tooltip}>
    <div className={styles.label}>{label}</div>
    <div>{name}: <strong className={cn(styles.value, styles[tone])}>{value}</strong></div>
    {hint && <div className={styles.muted}>{hint}</div>}
  </div>
);
