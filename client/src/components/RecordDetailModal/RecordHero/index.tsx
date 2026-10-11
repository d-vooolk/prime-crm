import React, { useState } from 'react';
import cn from 'classnames';
import dayjs from 'dayjs';
import type { Record } from '@/types';
import styles from './RecordHero.module.scss';

interface Props {
  record: Record;
}

const STATUS_LABELS: { [K in Record['status']]: string } = {
  ACTIVE: 'Активна',
  CLOSED: 'Завершена',
  CANCELLED: 'Отменена',
};

/**
 * Шапка карточки записи: фото выбранного авто на фоне, как первый экран страницы записи для клиента.
 * Нет поколения или фото не загрузилось — фирменный графитово-салатовый фон.
 */
export const RecordHero: React.FC<Props> = ({ record: r }) => {
  const [photoState, setPhotoState] = useState<'loading' | 'ready' | 'error'>('loading');
  const photoUrl = r.car.generationId
    ? `/api/cars/photo/${r.car.brandId}/${r.car.modelId}/${r.car.generationId}`
    : null;
  const showPhoto = !!photoUrl && photoState !== 'error';
  const details = [r.car.generationName, r.car.year, r.car.plateNumber].filter(Boolean).join(' · ');
  const when = dayjs(r.scheduledAt);

  return (
    <div className={cn(styles.hero, { [styles.withPhoto]: showPhoto })}>
      <div className={styles.backdrop} />
      {showPhoto && (
        <img
          className={cn(styles.photo, { [styles.photoReady]: photoState === 'ready' })}
          src={photoUrl}
          alt=""
          onLoad={() => setPhotoState('ready')}
          onError={() => setPhotoState('error')}
        />
      )}
      <div className={styles.shade} />

      <div className={styles.top}>
        <span className={styles.number}>Запись #{r.id.slice(-8).toUpperCase()}</span>
        <span className={cn(styles.status, styles[`status${r.status}`])}>{STATUS_LABELS[r.status]}</span>
      </div>

      <div className={styles.bottom}>
        <div className={styles.when}>
          <span className={styles.whenDay}>{when.format('dd, D MMMM')}</span>
          <span className={styles.whenTime}>{when.format('HH:mm')}</span>
        </div>
        <div className={styles.car}>
          {r.car.brand} {r.car.model}
        </div>
        {details && <div className={styles.details}>{details}</div>}
      </div>
    </div>
  );
};
