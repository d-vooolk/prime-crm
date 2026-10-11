import React from 'react';
import cn from 'classnames';
import { BookOutlined } from '@ant-design/icons';
import { useMissedWiki } from '@/hooks/useMissedWiki';
import { WikiKey } from '@/types';
import { formatPrice } from '@/utils/formatters';
import styles from './WikiPage.module.scss';

interface Props {
  /** Проверяющий видит всех сотрудников, сотрудник — свои авто */
  reviewer: boolean;
  selected: WikiKey;
  onSelect: (key: WikiKey) => void;
}

/**
 * Авто, по которым в этом расчётном периоде упущена премия за вики: сделка закрыта, а карточку
 * никто из главных сотрудников не заполнил. Заполнить ещё не поздно — нажатие открывает карточку.
 */
export const WikiMissedBanner: React.FC<Props> = ({ reviewer, selected, onSelect }) => {
  const { data } = useMissedWiki();
  const rows = (data?.employees ?? []).flatMap(e => e.items.map(i => ({ ...i, servicemanName: e.servicemanName })));
  if (!data || rows.length === 0) return null;

  const total = data.employees.reduce((s, e) => s + e.amount, 0);
  const isSelected = (r: typeof rows[number]) =>
    r.brandId === selected.markId && r.modelId === selected.modelId && r.generationId === selected.generationId;

  return (
    <section className={styles.missed}>
      <div className={styles.missedHead}>
        <span className={styles.missedIcon}><BookOutlined /></span>
        <div>
          <div className={styles.missedKicker}>Упущенная прибыль</div>
          <div className={styles.missedTitle}>
            {reviewer
              ? `Не описано после сделок: ${rows.length} авто · ${formatPrice(total)}`
              : `Можно заработать ${formatPrice(total)} — опишите ${rows.length} авто`}
          </div>
        </div>
      </div>
      <div className={styles.missedChips}>
        {rows.map(r => (
          <button
            key={`${r.servicemanName}-${r.recordId}`}
            type="button"
            className={cn(styles.missedChip, { [styles.missedChipActive]: isSelected(r) })}
            onClick={() => onSelect({ markId: r.brandId, modelId: r.modelId, generationId: r.generationId })}
          >
            {r.car}
            {reviewer && <span className={styles.missedWho}>{r.servicemanName}</span>}
          </button>
        ))}
      </div>
    </section>
  );
};
