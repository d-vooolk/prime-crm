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
  const totalPrepaid = data.services.reduce((sum, s) => sum + (s.prepaidAmount || 0), 0);

  return (
    <div>
      <Divider orientation="left" style={{ fontSize: 13 }}>Клиент</Divider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label={data.isLegalEntity ? 'ФИО представителя' : 'ФИО'}>
          {data.clientName || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Телефон">{data.clientPhone || '—'}</Descriptions.Item>
      </Descriptions>

      {data.isLegalEntity && (
        <>
          <Divider orientation="left" style={{ fontSize: 13 }}>Юридическое лицо</Divider>
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

      <Divider orientation="left" style={{ fontSize: 13 }}>Автомобиль</Divider>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Марка / Модель">
          {data.carBrand} {data.carModel}
        </Descriptions.Item>
        <Descriptions.Item label="Год">{data.carYear}</Descriptions.Item>
        {data.carGenerationName && (
          <Descriptions.Item label="Поколение">{data.carGenerationName}</Descriptions.Item>
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
        {data.services.map(s => {
          const paid = s.prepaidAmount || 0;
          const rowTotal = s.price * s.quantity;
          return (
            <div key={s.serviceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{s.serviceName}</span>
                {s.quantity > 1 && <Tag style={{ marginLeft: 6 }}>×{s.quantity}</Tag>}
                {paid > 0 && (
                  <Tag color={paid >= rowTotal ? 'success' : 'processing'} style={{ marginLeft: 6, fontSize: 11 }}>
                    {paid >= rowTotal ? 'Оплачено' : `Предоплата ${formatPrice(paid)}`}
                    {s.prepaidByCard ? ' (РС)' : ' (нал)'}
                  </Tag>
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{formatPrice(rowTotal)}</span>
            </div>
          );
        })}
      </div>

      <Divider />
      {totalPrepaid > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            <span>Предоплата:</span>
            <span style={{ color: 'var(--color-status-closed)', fontWeight: 600 }}>− {formatPrice(totalPrepaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--color-text-secondary)' }}>
            <span>Остаток к оплате:</span>
            <span style={{ fontWeight: 600 }}>{formatPrice(total - totalPrepaid)}</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Итого</span>
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-accent)' }}>
          {formatPrice(total)}
        </span>
      </div>
    </div>
  );
};
