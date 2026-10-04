import React from 'react';
import { Card, Avatar } from 'antd';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { Serviceman } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { averageAnnualSalary } from '@/utils/salary';
import { bestSalaryMonth } from '../utils';
import styles from './EmployeeCard.module.scss';

interface Props {
  employee: Serviceman;
  salary?: SalaryData;
  history: SalaryHistoryItem[];
  /** Цвет линии спарклайна строкой (из useChartColors) */
  lineColor: string;
  onClick: () => void;
}

/** Карточка сотрудника на вкладке «Сотрудники»: заработок периода, выплаты, среднее, рекорд и спарклайн */
export const EmployeeCard: React.FC<Props> = ({ employee: m, salary, history, lineColor, onClick }) => {
  const record = bestSalaryMonth(history);
  const avgAnnual = averageAnnualSalary(history);

  return (
    <Card className={styles.card} onClick={onClick} hoverable>
      <div className={styles.header}>
        <Avatar size={48} className={styles.avatar}>
          {m.name.charAt(0).toUpperCase()}
        </Avatar>
        <div className={styles.info}>
          <div className={styles.name}>{m.name}</div>
          {m.position && <div className={styles.position}>{m.position}</div>}
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>% от прибыли</span>
          <span className={styles.statValue}>{m.profitPercent ?? 0}%</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Заработок (тек. период)</span>
          <span className={styles.statEarnings}>
            {salary ? formatPrice(salary.adjustedTotal) : '—'}
          </span>
        </div>
        {salary && salary.paidTotal > 0 && (
          <>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Выплачено</span>
              <span className={styles.statPaid}>{formatPrice(salary.paidTotal)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{salary.remaining < 0 ? 'Переплата' : 'Осталось'}</span>
              <span className={salary.remaining < 0 ? styles.statOverpaid : styles.statRemaining}>
                {formatPrice(Math.abs(salary.remaining))}
              </span>
            </div>
          </>
        )}
        {avgAnnual.monthsCount > 0 && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Средний годичный</span>
            <span className={styles.statAvg}>{formatPrice(avgAnnual.average)}</span>
          </div>
        )}
        {record && history.length > 1 && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Рекорд</span>
            <span className={styles.statRecord}>{formatPrice(record.adjustedTotal)}</span>
          </div>
        )}
      </div>
      {history.length > 1 && (
        <div className={styles.sparkline}>
          <ResponsiveContainer width="100%" height={56}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Line type="monotone" dataKey="adjustedTotal" stroke={lineColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
