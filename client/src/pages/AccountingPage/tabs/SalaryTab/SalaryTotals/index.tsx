import React from 'react';
import { SalaryData } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import styles from './SalaryTotals.module.scss';

interface Props {
  salaryData: SalaryData;
  isMobile: boolean;
}

/** Итоговая строка расчёта: база, оклад, к выплате, выплачено и остаток */
export const SalaryTotals: React.FC<Props> = ({ salaryData, isMobile }) => {
  const remaining = salaryData.remaining;
  return (
    <div className={styles.totals}>
      {/* На телефоне база уже показана под списком записей */}
      {(salaryData.adjustments.length > 0 || salaryData.baseSalary > 0) && !isMobile && (
        <span className={styles.base}>База: {formatPrice(salaryData.totalPayment)}</span>
      )}
      {salaryData.baseSalary > 0 && (
        <span className={styles.base}>Оклад: {formatPrice(salaryData.baseSalary)}</span>
      )}
      <span>
        Итого к выплате:{' '}
        <strong className={styles.value}>{formatPrice(salaryData.adjustedTotal ?? salaryData.totalPayment)}</strong>
      </span>
      {salaryData.payments.length > 0 && (
        <>
          <span className={styles.base}>Выплачено: {formatPrice(salaryData.paidTotal)}</span>
          <span>
            {remaining < 0 ? 'Переплата: ' : 'Осталось: '}
            <strong className={remaining < 0 ? styles.overpaid : styles.remaining}>
              {formatPrice(Math.abs(remaining))}
            </strong>
          </span>
        </>
      )}
    </div>
  );
};
