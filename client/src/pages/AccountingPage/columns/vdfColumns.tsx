import React from 'react';
import { Button, Space, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { VdfOrder } from '@/api/accounting.api';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '../utils';
import styles from './columns.module.scss';

interface Options {
  executed: boolean;
  onEditAmount: (o: VdfOrder) => void;
  onExecute: (o: VdfOrder) => void;
}

/** Позиции заказа — в раскрывающейся строке */
export const VdfOrderItems: React.FC<{ order: VdfOrder }> = ({ order }) => (
  <ul className={styles.vdfItems}>
    {order.items.map((item, i) => (
      <li key={i}>
        {item.title}
        {item.options && ` (${item.options})`}
        {item.sku && <span className={styles.vdfSub}> · {item.sku}</span>}
        {' — '}
        {item.qty} × {formatMoney(item.price)} = {formatMoney(item.sum)}
      </li>
    ))}
  </ul>
);

export function vdfColumns({ executed, onEditAmount, onExecute }: Options): ColumnsType<VdfOrder> {
  return [
    {
      title: 'Выполнен в магазине',
      dataIndex: 'completedAt',
      width: 130,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Заказ',
      dataIndex: 'shopOrderId',
      width: 90,
      render: (v: number) => `№${v}`,
    },
    {
      title: 'Сотрудник',
      dataIndex: 'employeeName',
      render: (_: string, o) => (
        <div className={styles.amountCell}>
          <span>{o.employeeName}</span>
          {o.employeePhone && <span className={styles.vdfSub}>{o.employeePhone}</span>}
        </div>
      ),
    },
    {
      title: 'Позиций',
      width: 80,
      render: (_: unknown, o) => o.items.reduce((s, i) => s + i.qty, 0),
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      width: 170,
      render: (_: number, o) => (
        <div className={styles.amountCell}>
          <strong>{formatMoney(o.amount)}</strong>
          {o.amountEdited && <span className={styles.vdfSub}>в магазине {formatMoney(o.shopTotal)}</span>}
        </div>
      ),
    },
    ...(executed
      ? [
          {
            title: 'Исполнен',
            width: 200,
            render: (_: unknown, o: VdfOrder) => (
              <div className={styles.amountCell}>
                <span>{o.executedAt ? formatDate(o.executedAt) : '—'}</span>
                <span className={styles.vdfSub}>
                  {o.cashTransaction ? `изыматель: ${o.cashTransaction.person ?? '—'}` : 'расход удалён из кассы'}
                </span>
                {o.shopCancelled && <Tag color="orange">отменён в магазине</Tag>}
              </div>
            ),
          },
        ]
      : [
          {
            title: '',
            width: 220,
            render: (_: unknown, o: VdfOrder) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEditAmount(o)}>
                  Сумма
                </Button>
                <Button size="small" type="primary" danger onClick={() => onExecute(o)}>
                  Исполнить
                </Button>
              </Space>
            ),
          },
        ]),
  ];
}
