import React from 'react';
import cn from 'classnames';
import { Skeleton } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import type { Leader } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { effectiveSalaryMonth } from '@/utils/salary';
import { useLeaders } from '../hooks';
import styles from './LeadersPodium.module.scss';

const plural = (n: number, forms: [string, string, string]) => {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
};

/** Порядок на пьедестале: второе место слева, первое в центре, третье справа */
const PODIUM_ORDER = [2, 1, 3];

const Step: React.FC<{ leader?: Leader; place: number }> = ({ leader, place }) => (
  <div className={cn(styles.step, styles[`place${place}`], { [styles.empty]: !leader })}>
    <div className={styles.person}>
      {place === 1 && leader && <CrownOutlined className={styles.crown} />}
      <div className={styles.avatar}>{leader ? leader.name.charAt(0).toUpperCase() : '?'}</div>
      <div className={styles.name}>{leader?.name ?? 'Свободно'}</div>
      {leader && (
        <div className={styles.result}>
          {leader.earnings != null && <b>{formatPrice(leader.earnings)}</b>}
          <span>{leader.recordCount} {plural(leader.recordCount, ['машина', 'машины', 'машин'])}</span>
        </div>
      )}
    </div>
    <div className={styles.block}>
      <span className={styles.placeNumber}>{place}</span>
    </div>
  </div>
);

/** Пьедестал лидеров расчётного периода (по заработку) — видят все роли */
export const LeadersPodium: React.FC = () => {
  const { data: leaders, isPending } = useLeaders();
  const period = effectiveSalaryMonth().format('MMMM YYYY');

  return (
    <section className={styles.podium}>
      <div className={styles.head}>
        <div className={styles.kicker}>Лидеры периода</div>
        <div className={styles.period}>{period}</div>
      </div>
      {isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <div className={styles.stage}>
          {PODIUM_ORDER.map(place => (
            <Step key={place} place={place} leader={leaders?.find(l => l.place === place)} />
          ))}
        </div>
      )}
    </section>
  );
};
