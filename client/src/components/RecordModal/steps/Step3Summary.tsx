import React from 'react';
import { Descriptions, Tag, Divider } from 'antd';
import dayjs from 'dayjs';
import { formatPrice } from '@/utils/formatters';
import { RecordFormData } from '../types';

interface Props {
  data: RecordFormData;
}

export const Step3Summary: React.FC<Props> = ({ data }) => {
  const total = data.services.reduce((sum, s) => sum + s.price * s.quantity, 0);

  return (
    <div>
      <Divider orientation="left" style={{ fontSize: 13 }}>Клиент</Divider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="ФИО">{data.clientName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Телефон">{data.clientPhone || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left" style={{ fontSize: 13 }}>Автомобиль</Divider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Марка / Модель">
          {data.carBrand} {data.carModel}
        </Descriptions.Item>
        <Descriptions.Item label="Год">{data.carYear}</Descriptions.Item>
        {data.carGenerationName && (
          <Descriptions.Item label="Поколение">{data.carGenerationName}</Descriptions.Item>
        )}
        {data.carPlate && (
          <Descriptions.Item label="Гос. номер">{data.carPlate}</Descriptions.Item>
        )}
      </Descriptions>

      <Divider orientation="left" style={{ fontSize: 13 }}>Запись</Divider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Дата">
          {data.date ? dayjs(data.date).format('DD.MM.YYYY') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Время">{data.time || '—'}</Descriptions.Item>
        <Descriptions.Item label="Мастер">{data.serviceman || '—'}</Descriptions.Item>
      </Descriptions>

      {data.clientNotes && (
        <>
          <Divider orientation="left" style={{ fontSize: 13 }}>Примечание</Divider>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{data.clientNotes}</p>
        </>
      )}

      <Divider orientation="left" style={{ fontSize: 13 }}>Услуги</Divider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.services.map(s => (
          <div key={s.serviceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 500 }}>{s.serviceName}</span>
              {s.quantity > 1 && <Tag style={{ marginLeft: 6 }}>×{s.quantity}</Tag>}
            </div>
            <span style={{ fontWeight: 600 }}>{formatPrice(s.price * s.quantity)}</span>
          </div>
        ))}
      </div>

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Итого</span>
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)' }}>
          {formatPrice(total)}
        </span>
      </div>
    </div>
  );
};
