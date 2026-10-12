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

/** Ссылка сразу на незаполненный раздел карточки */
export const wikiHref = (i: Pick<MissedWikiItem, 'brandId' | 'modelId' | 'generationId' | 'sectionId'>) =>
  `/wiki?${new URLSearchParams({ mark: i.brandId, model: i.modelId, generation: i.generationId, section: i.sectionId })}`;

/**
 * Упущенная прибыль за вики: сделки периода с работами из настроек «Упущенная прибыль», после
 * которых главный сотрудник не заполнил раздел карточки авто. Каждая — ссылка на этот раздел:
 * заполнить ещё не поздно.
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
      <div className={styles.muted}>Все работы периода описаны в вики — так держать</div>
    ) : (
      <>
        <div className={styles.muted}>
          {bonus > 0 ? `${formatPrice(bonus)} за каждый раздел` : 'Премия за вики не задана в настройках'} · заполните — и премия ваша
        </div>
        <ul className={styles.list}>
          {items.map(i => (
            <li key={`${i.recordId}-${i.sectionId}`}>
              <Link to={wikiHref(i)} className={styles.item}>
                <span className={styles.car}>
                  {i.car}
                  <span className={styles.section}>{i.sectionName}</span>
                </span>
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
