import React from 'react';
import { Card, Statistic } from 'antd';
import cn from 'classnames';
import { SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { averageAnnualSalary } from '@/utils/salary';
import { salaryRecord } from '../../../utils';
import shared from '../../../shared.module.scss';
import styles from './SalaryStats.module.scss';

interface Props {
  salaryData: SalaryData | null;
  history: SalaryHistoryItem[];
}

/** Плитки над расчётом: начислено, остаток, рекорд, средний заработок */
export const SalaryStats: React.FC<Props> = ({ salaryData, history }) => {
  const remaining = salaryData?.remaining ?? 0;
  const record = salaryRecord(history, salaryData?.adjustedTotal);
  const avgAnnual = averageAnnualSalary(history);

  return (
    <div className={styles.salaryStats}>
      {salaryData && (
        <Card size="small" className={styles.statCard}>
          <Statistic
            title="К выплате за период"
            value={salaryData.adjustedTotal ?? salaryData.totalPayment}
            precision={2}
            suffix="р."
            className={cn(shared.stat, shared.statSuccess)}
          />
        </Card>
      )}

      {salaryData && salaryData.payments.length > 0 && (
        <Card size="small" className={styles.statCard}>
          <Statistic
            title={remaining < 0 ? 'Переплата' : 'Осталось выплатить'}
            value={Math.abs(remaining)}
            precision={2}
            suffix="р."
            className={cn(shared.stat, remaining < 0 ? shared.statError : shared.statPrimary)}
          />
          <div className={styles.statCardHint}>выплачено: {formatPrice(salaryData.paidTotal)}</div>
        </Card>
      )}

      {record && (
        <Card size="small" className={styles.statCard}>
          <Statistic
            title="Рекорд заработка"
            value={record.amount}
            precision={2}
            suffix="р."
            className={cn(shared.stat, shared.statWarning)}
          />
          <div className={styles.statCardHint}>{record.label}</div>
        </Card>
      )}

      {avgAnnual.monthsCount > 0 && (
        <Card size="small" className={styles.statCard}>
          <Statistic
            title="Средний годичный заработок"
            value={avgAnnual.average}
            precision={2}
            suffix="р."
            className={cn(shared.stat, shared.statPrimary)}
          />
          <div className={styles.statCardHint}>в месяц, за последние {avgAnnual.monthsCount} мес.</div>
        </Card>
      )}
    </div>
  );
};
