import React from 'react';
import cn from 'classnames';
import { formatPrice } from '@/utils/formatters';
import { ServicesTotals as Totals, formatHoursMinutes } from '../../calc';
import styles from './ServicesTotals.module.scss';

interface Props {
  totals: Totals;
  /** Компактный вид под карточками на телефоне */
  compact?: boolean;
}

/** Итог по услугам: предоплата, остаток, ориентировочное время и сумма */
export const ServicesTotals: React.FC<Props> = ({ totals, compact }) => {
  const { total, totalTime, totalPrepaid, remaining } = totals;
  const time = compact ? `~${formatHoursMinutes(totalTime)}` : `Ориентировочное время: ${formatHoursMinutes(totalTime)}`;

  return (
    <div className={cn(styles.root, { [styles.compact]: compact })}>
      {totalPrepaid > 0 && (
        <>
          <div className={styles.line}>
            <span>Предоплата:</span>
            <span className={styles.prepaid}>− {formatPrice(totalPrepaid)}</span>
          </div>
          <div className={styles.line}>
            <span>{compact ? 'Остаток:' : 'Остаток к оплате:'}</span>
            <span className={styles.strong}>{formatPrice(remaining)}</span>
          </div>
        </>
      )}
      <div className={cn(styles.totalLine, { [styles.separated]: totalPrepaid > 0 && !compact })}>
        <span className={styles.time}>{time}</span>
        <span className={styles.total}>{formatPrice(total)}</span>
      </div>
    </div>
  );
};
