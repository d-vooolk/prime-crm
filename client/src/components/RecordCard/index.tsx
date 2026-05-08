import React, { useState } from 'react';
import dayjs from 'dayjs';
import cn from 'classnames';
import { Record as CrmRecord } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
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

function toRgba(color: string, alpha: number): string {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  const clean = color.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const RecordCard: React.FC<Props> = ({ record, onClick }) => {
  const { client, car, items, status, scheduledAt, serviceman, deal, smsLogs } = record;
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const { user } = useAuthStore();
  const isEmployee = user?.role === 'Сотрудник';

  const total = deal
    ? deal.finalPrice
    : items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalPrepaid = !deal
    ? items.reduce((sum, item) => sum + (item.prepaidAmount || 0), 0)
    : 0;

  const time = dayjs(scheduledAt).format('HH:mm');
  const showPhoto = !!car.generationId && !photoError;

  const categoryColor = status === 'ACTIVE'
    ? (items[0]?.service?.category?.color ?? null)
    : null;
  const cardStyle = categoryColor ? { background: toRgba(categoryColor, 0.14) } : undefined;

  return (
    <div
      className={cn(styles.card, {
        [styles.closed]: status === 'CLOSED',
        [styles.cancelled]: status === 'CANCELLED',
      })}
      style={cardStyle}
      onClick={onClick}
    >
      <div className={styles.statusBar} />

      {showPhoto ? (
        <>
          {!photoLoaded && <div className={styles.carPhotoSkeleton} />}
          <img
            className={cn(styles.carPhoto, { [styles.photoHidden]: !photoLoaded })}
            src={`/api/cars/photo/${car.brandId}/${car.modelId}/${car.generationId}`}
            alt={`${car.brand} ${car.model}`}
            onLoad={() => setPhotoLoaded(true)}
            onError={() => { setPhotoError(true); setPhotoLoaded(true); }}
          />
        </>
      ) : (
        <div className={styles.carPhotoPlaceholder}>🚗</div>
      )}

      {smsLogs && smsLogs.length > 0 && (
        <div className={styles.smsLabels}>
          {smsLogs.map(log => (
            <span
              key={log.id}
              className={cn(styles.smsLabel, { [styles.smsLabelFailed]: log.status === 'failed' })}
              title={log.type === 'ON_CREATE' ? 'SMS при создании' : 'SMS напоминание'}
            />
          ))}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.time}>{time}</div>
          <div className={styles.carName}>
            {car.brand} {car.model}
            <span className={styles.carDetails}>
              {' ('}
              {[car.generationName, car.year, car.plateNumber].filter(Boolean).join(' · ')}
              {')'}
            </span>
          </div>
          <div className={styles.statusBadge}>{STATUS_LABELS[status]}</div>
        </div>
        <div className={cn(styles.phone, { [styles.blurred]: isEmployee })}>{client.phone}</div>
        <div className={cn(styles.clientName, { [styles.blurred]: isEmployee })}>{client.name}</div>

        {items.length > 0 && (
          <div className={styles.services}>
            {items.slice(0, 3).map((item, idx) => (
              <div key={item.id} className={cn(styles.serviceItem, { [styles.serviceItemHiddenMobile]: idx > 0 })}>
                <span>
                  {item.service.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  {idx === 0 && items.length > 1 && (
                    <span className={styles.moreServicesMobile}> +{items.length - 1}</span>
                  )}
                </span>
                {!isEmployee && (
                  <span className={styles.servicePrice}>{formatPrice(item.price * item.quantity)}</span>
                )}
              </div>
            ))}
            {items.length > 3 && (
              <div className={cn(styles.serviceItem, styles.serviceItemHiddenMobile)}>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  +{items.length - 3} услуги...
                </span>
              </div>
            )}
          </div>
        )}

        <div className={styles.footer}>
          {!isEmployee && (
            <div className={styles.total}>
              <span className={styles.totalLabel}>{deal ? 'Итого' : 'Предв. сумма'}</span>
              {totalPrepaid > 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={styles.totalAmount} style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: 13 }}>
                    {formatPrice(total)}
                  </span>
                  <span className={styles.totalAmount} style={{ color: 'var(--color-accent)' }}>
                    {formatPrice(total - totalPrepaid)}
                  </span>
                </span>
              ) : (
                <span className={styles.totalAmount}>{formatPrice(total)}</span>
              )}
            </div>
          )}
          <div className={styles.serviceman}>{serviceman}</div>
        </div>

      </div>
    </div>
  );
};
