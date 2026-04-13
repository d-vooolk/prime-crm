import React from 'react';
import dayjs from 'dayjs';
import cn from 'classnames';
import { Record as CrmRecord } from '@/types';
import { formatPrice } from '@/utils/formatters';
import styles from './RecordCard.module.scss';

interface Props {
  record: CrmRecord;
  onClick: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активна',
  CLOSED: 'Завершена',
  CANCELLED: 'Отменена',
};

export const RecordCard: React.FC<Props> = ({ record, onClick }) => {
  const { client, car, items, status, scheduledAt, serviceman, deal } = record;

  const total = deal
    ? deal.finalPrice
    : items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const time = dayjs(scheduledAt).format('HH:mm');

  return (
    <div
      className={cn(styles.card, {
        [styles.closed]: status === 'CLOSED',
        [styles.cancelled]: status === 'CANCELLED',
      })}
      onClick={onClick}
    >
      <div className={styles.statusBar} />

      <div className={styles.header}>
        <div className={styles.time}>{time}</div>
        <div className={styles.clientInfo}>
          <div className={styles.clientName}>{client.name}</div>
          <div className={styles.phone}>{client.phone}</div>
        </div>
        <div className={styles.statusBadge}>{STATUS_LABELS[status]}</div>
      </div>

      <div className={styles.carBlock}>
        {car.generationId ? (
          <img
            className={styles.carPhoto}
            src={`https://auto-data.api-home.ru/api/public/v1/marks/${car.brandId}/models/${car.modelId}/generations/${car.generationId}/photo`}
            alt={`${car.brand} ${car.model}`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className={styles.carPhotoPlaceholder}>🚗</div>
        )}
        <div className={styles.carInfo}>
          <div className={styles.carName}>{car.brand} {car.model}</div>
          <div className={styles.carDetails}>
            {car.generationName ? `${car.generationName} · ` : ''}{car.year}
            {car.plateNumber ? ` · ${car.plateNumber}` : ''}
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className={styles.services}>
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className={styles.serviceItem}>
              <span>
                {item.service.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </span>
              <span className={styles.servicePrice}>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          {items.length > 3 && (
            <div className={styles.serviceItem}>
              <span style={{ color: 'var(--color-text-muted)' }}>
                +{items.length - 3} услуги...
              </span>
            </div>
          )}
        </div>
      )}

      <div className={styles.total}>
        <span className={styles.totalLabel}>{deal ? 'Итого' : 'Предв. сумма'}</span>
        <span className={styles.totalAmount}>{formatPrice(total)}</span>
      </div>

      <div className={styles.serviceman}>{serviceman}</div>
    </div>
  );
};
