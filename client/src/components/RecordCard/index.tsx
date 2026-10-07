import React, { useState } from 'react';
import dayjs from 'dayjs';
import cn from 'classnames';
import { Record as CrmRecord, SmsType } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { isEmployee as isEmployeeRole } from '@/utils/roles';
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

const SMS_LABELS: Record<SmsType, string> = {
  ON_CREATE: 'SMS при создании',
  REMINDER: 'SMS напоминание',
  CAR_READY: 'SMS «Авто готово»',
  REVIEW_REQUEST: 'SMS запрос отзыва',
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
  const isEmployee = isEmployeeRole(user);

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
  // Цвет категории приходит из данных — единственное динамическое значение, передаём его
  // CSS-переменной, а сам фон задаёт класс .tinted
  const cardStyle = categoryColor
    ? { '--card-tint': toRgba(categoryColor, 0.14) } as React.CSSProperties
    : undefined;

  return (
    <div
      className={cn(styles.card, {
        [styles.closed]: status === 'CLOSED',
        [styles.cancelled]: status === 'CANCELLED',
        [styles.tinted]: !!categoryColor,
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
              title={SMS_LABELS[log.type]}
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
        {/* Сотрудникам контакты клиента не показываем */}
        {!isEmployee && (
          <>
            <div className={styles.phone}>{client.phone}</div>
            <div className={styles.clientName}>{client.name}</div>
          </>
        )}

        {items.length > 0 && (
          <div className={styles.services}>
            {items.slice(0, 3).map(item => (
              <div key={item.id} className={styles.serviceItem}>
                <span>
                  {item.service.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </span>
                {!isEmployee && (
                  <span className={styles.servicePrice}>{formatPrice(item.price * item.quantity)}</span>
                )}
              </div>
            ))}
            {items.length > 3 && (
              <div className={styles.serviceItem}>
                <span className={styles.moreServices}>
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
                <span className={styles.totalWithPrepaid}>
                  <span className={cn(styles.totalAmount, styles.totalStruck)}>
                    {formatPrice(total)}
                  </span>
                  <span className={cn(styles.totalAmount, styles.totalRemaining)}>
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
