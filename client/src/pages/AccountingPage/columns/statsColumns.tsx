import React from 'react';
import { Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MonthlyRecordCountItem, MonthlyRevenueItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { AvgCheckRow } from '../utils';
import styles from './columns.module.scss';

const OverrideMark: React.FC = () => (
  <Tooltip title="Значение задано вручную">
    <span className={styles.overrideMark}>●</span>
  </Tooltip>
);

export const revenueColumns: ColumnsType<MonthlyRevenueItem> = [
  { title: 'Период', dataIndex: 'label', key: 'period' },
  {
    title: 'Сумма',
    dataIndex: 'amount',
    key: 'amount',
    align: 'right',
    render: (v: number, row) => (
      <span className={styles.revenueValue}>
        {formatPrice(v)}
        {row.isOverride && <OverrideMark />}
      </span>
    ),
  },
];

export const recordCountColumns: ColumnsType<MonthlyRecordCountItem> = [
  { title: 'Период', dataIndex: 'label', key: 'period' },
  {
    title: 'Записей',
    dataIndex: 'count',
    key: 'count',
    align: 'right',
    render: (v: number, row) => (
      <span className={styles.countValue}>
        {v}
        {row.isOverride && <OverrideMark />}
      </span>
    ),
  },
];

export const avgCheckColumns: ColumnsType<AvgCheckRow> = [
  { title: 'Период', dataIndex: 'label', key: 'period' },
  {
    title: 'Средний чек',
    dataIndex: 'avg',
    key: 'avg',
    align: 'right',
    render: (v: number) => <span className={styles.avgValue}>{v > 0 ? formatPrice(v) : '—'}</span>,
  },
];
