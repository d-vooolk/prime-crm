import React from 'react';
import cn from 'classnames';
import { Card, Avatar } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { Serviceman } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { averageAnnualSalary } from '@/utils/salary';
import { bestSalaryMonth } from '../utils';
import styles from './EmployeeCard.module.scss';

interface Props {
  employee: Serviceman;
  /** Место в рейтинге по заработку периода; null — ещё ничего не заработал */
  rank: number | null;
  salary?: SalaryData;
  history: SalaryHistoryItem[];
  /** Упущенная премия за вики в периоде; нет — строку не показываем */
  missed?: { amount: number; count: number };
  /** Цвет линии спарклайна строкой (из useChartColors) */
  lineColor: string;
  onClick: () => void;
}

/** Карточка сотрудника на вкладке «Сотрудники»: заработок периода, выплаты, среднее, рекорд и спарклайн */
export const EmployeeCard: React.FC<Props> = ({ employee: m, rank, salary, history, missed, lineColor, onClick }) => {
  const record = bestSalaryMonth(history);
  const avgAnnual = averageAnnualSalary(history);
  // Прогресс к личному рекорду месяца (рекорд — из истории, при одном месяце сравнивать не с чем)
  const current = salary?.adjustedTotal ?? 0;
  const recordValue = record && history.length > 1 ? record.adjustedTotal : 0;
  const toRecord = recordValue > 0 ? Math.min(1, current / recordValue) : 0;
  const isRecord = recordValue > 0 && current >= recordValue;

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
        {rank != null && (
          <span className={cn(styles.rank, { [styles[`rank${rank}`]]: rank <= 3 })} title="Место по заработку за период">
            #{rank}
          </span>
        )}
      </div>
      {recordValue > 0 && (
        <div className={styles.goal}>
          <div className={styles.goalHead}>
            <span>До личного рекорда</span>
            {isRecord
              ? <span className={styles.recordBadge}><RocketOutlined /> Рекорд!</span>
              : <span className={styles.goalPct}>{Math.round(toRecord * 100)}%</span>}
          </div>
          <div className={styles.goalBar}>
            {/* Заполнение — данные, через CSS-переменную */}
            <span style={{ '--fill': `${Math.round(toRecord * 100)}%` } as React.CSSProperties} />
          </div>
        </div>
      )}
      <div className={styles.stats}>
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
      {missed && missed.count > 0 && (
        <div className={styles.missed}>
          <span>Упущено за вики · {missed.count} авто</span>
          <b>{formatPrice(missed.amount)}</b>
        </div>
      )}
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
