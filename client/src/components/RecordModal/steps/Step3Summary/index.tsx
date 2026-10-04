import React from 'react';
import { Descriptions, Tag, Divider } from 'antd';
import dayjs from 'dayjs';
import { formatPrice } from '@/utils/formatters';
import { RecordFormData } from '../../types';
import { servicesTotals } from '../../calc';
import { SectionDivider } from '../../parts/SectionDivider';
import styles from './Step3Summary.module.scss';

interface Props {
  data: RecordFormData;
}

/** Шаг 3: итог записи перед сохранением */
export const Step3Summary: React.FC<Props> = ({ data }) => {
  const { total, totalPrepaid, remaining } = servicesTotals(data.services);

  return (
    <div>
      <SectionDivider muted={false}>Клиент</SectionDivider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label={data.isLegalEntity ? 'ФИО представителя' : 'ФИО'}>
          {data.clientName || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Телефон">{data.clientPhone || '—'}</Descriptions.Item>
      </Descriptions>

      {data.isLegalEntity && (
        <>
          <SectionDivider muted={false}>Юридическое лицо</SectionDivider>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            {data.legalCompanyName && (
              <Descriptions.Item label="Организация" span={2}>{data.legalCompanyName}</Descriptions.Item>
            )}
            {data.legalAddress && (
              <Descriptions.Item label="Юр. адрес" span={2}>{data.legalAddress}</Descriptions.Item>
            )}
            {data.legalUnp && <Descriptions.Item label="УНП">{data.legalUnp}</Descriptions.Item>}
            {data.legalBic && <Descriptions.Item label="БИК">{data.legalBic}</Descriptions.Item>}
            {data.legalOkpo && <Descriptions.Item label="ОКПО">{data.legalOkpo}</Descriptions.Item>}
          </Descriptions>
        </>
      )}

      <SectionDivider muted={false}>Автомобиль</SectionDivider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Марка / Модель">
          {data.carBrand} {data.carModel}
        </Descriptions.Item>
        <Descriptions.Item label="Год">{data.carYear}</Descriptions.Item>
        {data.carGenerationName && (
          <Descriptions.Item label="Поколение">{data.carGenerationName}</Descriptions.Item>
        )}
      </Descriptions>

      <SectionDivider muted={false}>Запись</SectionDivider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Дата">
          {data.date ? dayjs(data.date).format('DD.MM.YYYY') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Время">{data.time || '—'}</Descriptions.Item>
        <Descriptions.Item label="Мастер">{data.serviceman || '—'}</Descriptions.Item>
      </Descriptions>

      {data.clientNotes && (
        <>
          <SectionDivider muted={false}>Примечание</SectionDivider>
          <p className={styles.notes}>{data.clientNotes}</p>
        </>
      )}

      <SectionDivider muted={false}>Услуги</SectionDivider>
      <div className={styles.services}>
        {data.services.map(s => {
          const paid = s.prepaidAmount || 0;
          const rowTotal = s.price * s.quantity;
          return (
            <div key={s.serviceId} className={styles.service}>
              <div>
                <span className={styles.serviceName}>{s.serviceName}</span>
                {s.quantity > 1 && <Tag className={styles.tag}>×{s.quantity}</Tag>}
                {paid > 0 && (
                  <Tag color={paid >= rowTotal ? 'success' : 'processing'} className={`${styles.tag} ${styles.prepayTag}`}>
                    {paid >= rowTotal ? 'Оплачено' : `Предоплата ${formatPrice(paid)}`}
                    {s.prepaidByCard ? ' (РС)' : ' (нал)'}
                  </Tag>
                )}
              </div>
              <span className={styles.serviceTotal}>{formatPrice(rowTotal)}</span>
            </div>
          );
        })}
      </div>

      <Divider />
      {totalPrepaid > 0 && (
        <div className={styles.prepaidBlock}>
          <div className={styles.line}>
            <span>Предоплата:</span>
            <span className={styles.prepaid}>− {formatPrice(totalPrepaid)}</span>
          </div>
          <div className={styles.line}>
            <span>Остаток к оплате:</span>
            <span className={styles.strong}>{formatPrice(remaining)}</span>
          </div>
        </div>
      )}
      <div className={styles.totalLine}>
        <span className={styles.totalLabel}>Итого</span>
        <span className={styles.total}>{formatPrice(total)}</span>
      </div>
    </div>
  );
};
