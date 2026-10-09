import React from 'react';
import { Descriptions, Divider, Table, Tag } from 'antd';
import type { Record, RecordItem } from '@/types';
import { formatDate, formatPrice } from '@/utils/formatters';
import { TWO_COLUMNS } from '@/config/descriptions';
import styles from './RecordItems.module.scss';

interface Props {
  record: Record;
  isEmployee: boolean;
}

/** Услуги записи с итогом и, если сделка закрыта, её данные */
export const RecordItems: React.FC<Props> = ({ record: r, isEmployee }) => {
  const total = r.deal
    ? r.deal.finalPrice
    : r.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalPrepaid = r.deal ? 0 : r.items.reduce((s, i) => s + (i.prepaidAmount || 0), 0);

  const columns = [
    {
      title: 'Услуга', key: 'name',
      render: (_: unknown, row: RecordItem) => {
        const paid = row.prepaidAmount || 0;
        const rowTotal = row.price * row.quantity;
        return (
          <div>
            <div>{row.service.name}</div>
            {!isEmployee && paid > 0 && (
              <Tag color={paid >= rowTotal ? 'success' : 'processing'} className={styles.prepaidTag}>
                {paid >= rowTotal ? 'Оплачено' : `Предоплата ${formatPrice(paid)}`}
                {row.prepaidByCard ? ' (РС)' : ' (нал)'}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Категория', key: 'cat',
      render: (_: unknown, row: RecordItem) => <Tag>{row.service.category?.name}</Tag>,
    },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 80 },
    // Сотрудникам цены не показываем
    ...(!isEmployee ? [
      {
        title: 'Цена', key: 'price', width: 120,
        render: (_: unknown, row: RecordItem) => formatPrice(row.price),
      },
      {
        title: 'Итого', key: 'total', width: 120,
        render: (_: unknown, row: RecordItem) => <strong>{formatPrice(row.price * row.quantity)}</strong>,
      },
    ] : []),
  ];

  return (
    <>
      <Divider orientation="left" className={styles.divider}>Услуги</Divider>
      <Table
        dataSource={r.items}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        footer={isEmployee ? undefined : () => (
          <div className={styles.totals}>
            {totalPrepaid > 0 && (
              <>
                <div className={styles.totalRow}>
                  <span>Предоплата:</span>
                  <span className={styles.prepaidValue}>− {formatPrice(totalPrepaid)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Остаток к оплате:</span>
                  <span className={styles.bold}>{formatPrice(total - totalPrepaid)}</span>
                </div>
              </>
            )}
            <div className={styles.grandTotal}>
              {r.deal ? 'Итого: ' : 'Предв. итого: '}{formatPrice(total)}
            </div>
          </div>
        )}
      />

      {r.deal && (
        <>
          <Divider orientation="left" className={styles.divider}>Сделка закрыта</Divider>
          <Descriptions size="small" column={TWO_COLUMNS}>
            <Descriptions.Item label="Выдано">{formatDate(r.deal.closedAt)}</Descriptions.Item>
            {r.deal.warranty && (
              <Descriptions.Item label="Гарантия">{r.deal.warranty}</Descriptions.Item>
            )}
            {r.deal.priceIncreaseReason && (
              <Descriptions.Item label="Обоснование цены" span={2}>
                {r.deal.priceIncreaseReason}
              </Descriptions.Item>
            )}
            {r.deal.equipment.length > 0 && (
              <Descriptions.Item label="Bi-Led модули" span={2}>
                {r.deal.equipment.map(e => e.equipment.name).join(', ')}
              </Descriptions.Item>
            )}
          </Descriptions>
          {/* Длинные тексты — отдельными блоками на всю ширину карточки, а не в колонке Descriptions.
              Обнаруженные недостатки — в начале карточки (DefectsEditor) */}
          {r.deal.recommendations && (
            <div className={styles.textBlock}>
              <div className={styles.textBlockLabel}>Рекомендации</div>
              <div className={styles.multiline}>{r.deal.recommendations}</div>
            </div>
          )}
        </>
      )}
    </>
  );
};
