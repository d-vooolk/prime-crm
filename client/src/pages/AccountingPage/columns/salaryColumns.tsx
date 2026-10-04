import React from 'react';
import { Button, Tooltip } from 'antd';
import { RetweetOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { SalaryRecord, SalaryRecordItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { formatDate } from '../utils';
import styles from './columns.module.scss';

interface Options {
  canSeeClientName: boolean;
  /** Переносить запись в другой период может тот, кто видит кассу */
  canTransfer: boolean;
  onTransfer: (row: SalaryRecord) => void;
}

export const transferTitle = (row: SalaryRecord) =>
  (row.salaryDate ? 'Период перенесён — изменить' : 'Перенести на другой период');

/** Иконка переноса подсвечивается, если период уже перенесён */
export const TransferIcon: React.FC<{ row: SalaryRecord }> = ({ row }) => (
  <RetweetOutlined className={row.salaryDate ? styles.transferred : undefined} />
);

export const salaryColumns = ({ canSeeClientName, canTransfer, onTransfer }: Options): ColumnsType<SalaryRecord> => [
  {
    title: canSeeClientName ? 'Клиент / Авто' : 'Авто',
    dataIndex: 'clientName',
    key: 'clientName',
    render: (name: string, row) => (
      <div>
        {canSeeClientName && <div className={styles.salaryClient}>{name}</div>}
        <div className={canSeeClientName ? styles.salaryCarSub : styles.salaryCarMain}>{row.carInfo}</div>
      </div>
    ),
  },
  { title: 'Дата', dataIndex: 'closedAt', key: 'date', width: 110, render: (d: string) => formatDate(d) },
  { title: 'Сумма', dataIndex: 'totalNetProfit', key: 'netProfit', width: 140, render: (v: number) => formatPrice(v) },
  {
    title: 'К выплате',
    dataIndex: 'totalPayment',
    key: 'payment',
    width: 120,
    render: (v: number) => <strong className={styles.payment}>{formatPrice(v)}</strong>,
  },
  ...(canTransfer ? [{
    title: '',
    key: 'transfer',
    width: 40,
    render: (_: unknown, row: SalaryRecord) => (
      <Tooltip title={transferTitle(row)}>
        <Button type="text" size="small" icon={<TransferIcon row={row} />} onClick={() => onTransfer(row)} />
      </Tooltip>
    ),
  }] : []),
];

export const salaryItemColumns: ColumnsType<SalaryRecordItem> = [
  { title: 'Услуга', dataIndex: 'serviceName', key: 'name' },
  { title: 'Сумма', dataIndex: 'netProfit', key: 'netProfit', width: 140, render: (v: number) => formatPrice(v) },
  {
    title: 'К выплате',
    dataIndex: 'payment',
    key: 'payment',
    width: 120,
    render: (v: number) => <strong className={styles.payment}>{formatPrice(v)}</strong>,
  },
];
