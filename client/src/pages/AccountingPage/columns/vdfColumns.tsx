import React from 'react';
import { Button, Popconfirm, Space, Tag } from 'antd';
import { EditOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { VdfOrder, VdfOrderStatus } from '@/api/accounting.api';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '../utils';
import styles from './columns.module.scss';

interface Options {
  view: VdfOrderStatus;
  onEditAmount: (o: VdfOrder) => void;
  onExecute: (o: VdfOrder) => void;
  onCancel: (o: VdfOrder) => void;
  onRestore: (o: VdfOrder) => void;
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

const executedColumn = {
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
};

const pendingColumn = (
  onEditAmount: (o: VdfOrder) => void,
  onExecute: (o: VdfOrder) => void,
  onCancel: (o: VdfOrder) => void,
) => ({
  title: '',
  width: 320,
  render: (_: unknown, o: VdfOrder) => (
    <Space wrap>
      <Button size="small" icon={<EditOutlined />} onClick={() => onEditAmount(o)}>
        Сумма
      </Button>
      <Button size="small" type="primary" danger onClick={() => onExecute(o)}>
        Исполнить
      </Button>
      <Button size="small" icon={<StopOutlined />} onClick={() => onCancel(o)}>
        Отменить
      </Button>
    </Space>
  ),
});

const cancelledColumn = (onRestore: (o: VdfOrder) => void) => ({
  title: 'Отменён',
  width: 260,
  render: (_: unknown, o: VdfOrder) => (
    <div className={styles.amountCell}>
      <span>{o.cancelledAt ? formatDate(o.cancelledAt) : '—'}</span>
      {o.cancelledByName && <span className={styles.vdfSub}>{o.cancelledByName}</span>}
      {o.cancelReason && <span className={styles.vdfSub}>причина: {o.cancelReason}</span>}
      <Popconfirm
        title="Вернуть заказ в ожидающие?"
        onConfirm={() => onRestore(o)}
        okText="Вернуть"
        cancelText="Нет"
      >
        <Button size="small" icon={<RollbackOutlined />}>Вернуть</Button>
      </Popconfirm>
    </div>
  ),
});

export function vdfColumns({ view, onEditAmount, onExecute, onCancel, onRestore }: Options): ColumnsType<VdfOrder> {
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
    view === 'EXECUTED'
      ? executedColumn
      : view === 'CANCELLED' ? cancelledColumn(onRestore) : pendingColumn(onEditAmount, onExecute, onCancel),
  ];
}
