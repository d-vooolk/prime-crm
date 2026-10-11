import React from 'react';
import { Link } from 'react-router-dom';
import { BookOutlined, RightOutlined } from '@ant-design/icons';
import type { MissedWikiItem } from '@/api/accounting.api';
import { formatDate, formatPrice } from '@/utils/formatters';
import styles from './MissedWikiCard.module.scss';

interface Props {
  amount: number;
  bonus: number;
  items: MissedWikiItem[];
}

export const wikiHref = (i: Pick<MissedWikiItem, 'brandId' | 'modelId' | 'generationId'>) =>
  `/wiki?${new URLSearchParams({ mark: i.brandId, model: i.modelId, generation: i.generationId })}`;

/**
 * Упущенная прибыль за вики: сделки периода, после которых главный сотрудник не заполнил
 * карточку авто в вики. Каждая — ссылка на карточку: заполнить ещё не поздно.
 */
export const MissedWikiCard: React.FC<Props> = ({ amount, bonus, items }) => (
  <section className={styles.card}>
    <div className={styles.head}>
      <span className={styles.icon}><BookOutlined /></span>
      <div className={styles.headText}>
        <div className={styles.kicker}>Упущенная прибыль · вики</div>
        <div className={styles.amount}>{formatPrice(amount)}</div>
      </div>
    </div>
    {items.length === 0 ? (
      <div className={styles.muted}>Все авто периода описаны в вики — так держать</div>
    ) : (
      <>
        <div className={styles.muted}>
          {bonus > 0 ? `${formatPrice(bonus)} за каждое авто` : 'Премия за вики не задана в настройках'} · заполните — и премия ваша
        </div>
        <ul className={styles.list}>
          {items.map(i => (
            <li key={i.recordId}>
              <Link to={wikiHref(i)} className={styles.item}>
                <span className={styles.car}>{i.car}</span>
                <span className={styles.date}>{formatDate(i.closedAt)}</span>
                <RightOutlined className={styles.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      </>
    )}
  </section>
);
