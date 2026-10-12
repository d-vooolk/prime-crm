import React from 'react';
import cn from 'classnames';
import { BookOutlined } from '@ant-design/icons';
import { useMissedWiki } from '@/hooks/useMissedWiki';
import { WikiKey } from '@/types';
import { formatPrice, plural } from '@/utils/formatters';
import styles from './WikiPage.module.scss';

interface Props {
  selected: WikiKey;
  sectionId?: string;
  onSelect: (key: WikiKey, sectionId: string) => void;
}

/**
 * Разделы карточек вики, по которым сотрудник в этом расчётном периоде упустил премию: сделка
 * с работами раздела закрыта, а раздел он не заполнил. Заполнить ещё не поздно — нажатие
 * открывает карточку сразу на нужном разделе.
 * Показывается только сотрудникам (WikiPage); руководители видят упущенное в дашборде.
 */
export const WikiMissedBanner: React.FC<Props> = ({ selected, sectionId, onSelect }) => {
  const { data } = useMissedWiki();
  const rows = (data?.employees ?? []).flatMap(e => e.items.map(i => ({ ...i, servicemanName: e.servicemanName })));
  if (!data || rows.length === 0) return null;

  const total = data.employees.reduce((s, e) => s + e.amount, 0);
  const isSelected = (r: typeof rows[number]) =>
    r.brandId === selected.markId && r.modelId === selected.modelId && r.generationId === selected.generationId
    && r.sectionId === sectionId;

  return (
    <section className={styles.missed}>
      <div className={styles.missedHead}>
        <span className={styles.missedIcon}><BookOutlined /></span>
        <div>
          <div className={styles.missedKicker}>Упущенная прибыль</div>
          <div className={styles.missedTitle}>
            {`Можно заработать ${formatPrice(total)} — заполните ${rows.length} ${plural(rows.length, ['раздел', 'раздела', 'разделов'])} вики`}
          </div>
        </div>
      </div>
      <div className={styles.missedChips}>
        {rows.map(r => (
          <button
            key={`${r.servicemanName}-${r.recordId}-${r.sectionId}`}
            type="button"
            className={cn(styles.missedChip, { [styles.missedChipActive]: isSelected(r) })}
            onClick={() => onSelect({ markId: r.brandId, modelId: r.modelId, generationId: r.generationId }, r.sectionId)}
          >
            {r.car}
            <span className={styles.missedChipSection}>{r.sectionName}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
