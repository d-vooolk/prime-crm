import React from 'react';
import { Button, Popconfirm, Space } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { CapitalTransaction } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { formatDate } from '../utils';

const bynCol = { title: 'BYN', dataIndex: 'amountByn', key: 'byn', width: 100, render: (v?: number) => (v != null ? formatPrice(v) : '—') };
const usdCol = { title: 'USD', dataIndex: 'amountUsd', key: 'usd', width: 100, render: (v?: number) => (v != null ? `$${v.toFixed(2)}` : '—') };
const eurCol = { title: 'EUR', dataIndex: 'amountEur', key: 'eur', width: 100, render: (v?: number) => (v != null ? `€${v.toFixed(2)}` : '—') };
const rateCol = { title: 'Курс', dataIndex: 'rate', key: 'rate', width: 80, render: (v?: number | null) => v ?? '—' };
const dateCol = { title: 'Дата', dataIndex: 'date', key: 'date', width: 100, render: (d: string) => formatDate(d) };

export const depositColumns: ColumnsType<CapitalTransaction> = [
  dateCol,
  { title: 'Откуда', dataIndex: 'description', key: 'description', width: 200, render: (v?: string) => v || '—' },
  bynCol, usdCol, eurCol, rateCol,
];

export const withdrawalColumns: ColumnsType<CapitalTransaction> = [
  dateCol,
  bynCol, usdCol, eurCol, rateCol,
  // ширина задана явно: без неё колонка схлопывалась на узком экране
  { title: 'Цель', dataIndex: 'description', key: 'description', width: 200, render: (v?: string) => v || '—' },
  { title: 'Изыматель', dataIndex: 'person', key: 'person', width: 130 },
];

/** Колонка «изменить/удалить» — только создателю */
export const capitalActionColumns = (
  enabled: boolean,
  onEdit: (tx: CapitalTransaction) => void,
  onDelete: (id: string) => void,
): ColumnsType<CapitalTransaction> => (enabled ? [{
  title: '',
  key: 'actions',
  width: 72,
  render: (_, r) => (
    <Space size={2}>
      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(r)} />
      <Popconfirm
        title="Удалить операцию из капитала?"
        description="Касса и долги не изменятся"
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
