import React from 'react';
import { Button, Popconfirm, Space, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { CashTransaction } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { formatDate } from '../utils';
import styles from './columns.module.scss';

const amountWithPrepaid = (r: CashTransaction) => (
  <div className={styles.amountCell}>
    <strong>{formatPrice(r.amount)}</strong>
    {r.isPrepayment && <Tag color="processing" className={styles.prepaidTag}>Предоплата</Tag>}
  </div>
);

export const incomeColumns: ColumnsType<CashTransaction> = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  {
    title: 'Клиент / Источник', key: 'client', width: 160, ellipsis: true,
    render: (_, r) => {
      if (r.type === 'MANUAL_INCOME') return <Tag color="blue">Ввод: {r.description}</Tag>;
      if (r.clientName) return r.clientName;
      // приход без клиента (например, погашение долга) — показываем назначение
      return r.description ? <Tag color="gold">{r.description}</Tag> : '—';
    },
  },
  { title: 'Авто', key: 'car', width: 140, ellipsis: true, render: (_, r) => r.carInfo || '—' },
  { title: 'Телефон', key: 'phone', width: 120, render: (_, r) => r.clientPhone || '—' },
  { title: 'Сумма', key: 'amount', width: 120, render: (_, r) => amountWithPrepaid(r) },
];

export const incomeRsColumns: ColumnsType<CashTransaction> = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  { title: 'Клиент', key: 'client', width: 160, ellipsis: true, render: (_, r) => r.clientName },
  { title: 'Авто', key: 'car', width: 140, ellipsis: true, render: (_, r) => r.carInfo || '—' },
  { title: 'Телефон', key: 'phone', width: 120, render: (_, r) => r.clientPhone || '—' },
  { title: 'Сумма', key: 'amount', width: 120, render: (_, r) => amountWithPrepaid(r) },
];

export const expenseColumns: ColumnsType<CashTransaction> = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 90, render: (d: string) => formatDate(d) },
  // без ellipsis — длинное пояснение переносится по строкам, а не обрезается
  { title: 'Цель', dataIndex: 'description', key: 'desc', width: 200 },
  {
    title: 'Категория', key: 'category', width: 130,
    render: (_, r) => {
      const category = r.expenseCategory ?? r.debtPayment?.debt?.expenseCategory;
      return category ? <Tag>{category.name}</Tag> : '—';
    },
  },
  { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => <strong>{formatPrice(v)}</strong> },
  { title: 'Изыматель', dataIndex: 'person', key: 'person', width: 120 },
];

/** Колонка «изменить/удалить» — только у тех, кому можно править проводки */
export const txActionColumns = (
  enabled: boolean,
  onEdit: (tx: CashTransaction) => void,
  onDelete: (id: string) => void,
): ColumnsType<CashTransaction> => (enabled ? [{
  title: '',
  key: 'actions',
  width: 72,
  render: (_, r) => (
    <Space size={2}>
      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(r)} />
      <Popconfirm
        title="Удалить запись?"
        onConfirm={() => onDelete(r.id)}
        okText="Да"
        cancelText="Нет"
        okButtonProps={{ danger: true }}
      >
        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </Space>
  ),
}] : []);
