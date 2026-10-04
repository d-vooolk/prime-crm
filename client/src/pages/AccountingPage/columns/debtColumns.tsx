import React from 'react';
import { Button, Popconfirm, Space, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Debt } from '@/api/accounting.api';
import { formatMoney } from '@/utils/formatters';
import { debtPaidTotal, formatDate } from '../utils';
import styles from './columns.module.scss';

interface Options {
  showArchive: boolean;
  /** Редактировать и удалять долги могут директор и выше */
  canManage: boolean;
  onPay: (d: Debt) => void;
  onEdit: (d: Debt) => void;
  onDelete: (id: string) => void;
}

const DebtAmount: React.FC<{ debt: Debt }> = ({ debt: d }) => {
  const cur = d.currency ?? 'BYN';
  const paid = debtPaidTotal(d);
  // Платёж в другой валюте показываем как платили: «300 р. по 3.02»
  const paymentText = (p: Debt['payments'][number]) =>
    p.paidCurrency && p.paidCurrency !== cur && p.paidAmount != null
      ? `${formatMoney(p.paidAmount, p.paidCurrency)} по ${p.rate}`
      : formatMoney(p.amount, cur);

  if (d.status === 'SETTLED' || paid === 0) {
    return (
      <div className={styles.debtAmount}>
        <strong>{formatMoney(d.initialAmount, cur)}</strong>
        {d.payments.length > 0 && (
          <span className={styles.debtPayments}>{d.payments.map(paymentText).join(' + ')}</span>
        )}
      </div>
    );
  }
  return (
    <div className={styles.debtAmount}>
      <span className={styles.debtPayments}>
        Погашено: {d.payments.map(paymentText).join(' + ')} = {formatMoney(paid, cur)}
      </span>
      <strong className={styles.debtRemaining}>
        Остаток: {formatMoney(d.remainingAmount, cur)}
      </strong>
    </div>
  );
};

export const debtColumns = ({ showArchive, canManage, onPay, onEdit, onDelete }: Options): ColumnsType<Debt> => [
  {
    title: 'Тип',
    key: 'direction',
    width: 130,
    render: (_, d) => (d.direction === 'WE_OWE'
      ? <Tag color="orange">Мы должны</Tag>
      : <Tag color="green">Нам должны</Tag>),
  },
  { title: 'За что', dataIndex: 'description', key: 'description', ellipsis: true },
  {
    title: 'Категория',
    key: 'category',
    width: 140,
    render: (_, d) => (d.expenseCategory ? <Tag>{d.expenseCategory.name}</Tag> : '—'),
  },
  { title: 'Сумма', key: 'amount', width: 140, render: (_, d) => <DebtAmount debt={d} /> },
  { title: 'Создано', dataIndex: 'createdAt', key: 'createdAt', width: 110, render: (d: string) => formatDate(d) },
  ...(showArchive ? [{
    title: 'Закрыто',
    dataIndex: 'settledAt',
    key: 'settledAt',
    width: 110,
    render: (d: string | null) => (d ? formatDate(d) : '—'),
  }] : []),
  {
    title: 'Действия',
    key: 'actions',
    width: 220,
    render: (_, d) => (
      <Space>
        {d.status === 'ACTIVE' && (
          <Button size="small" type="primary" onClick={() => onPay(d)}>Исполнить</Button>
        )}
        {canManage && d.status === 'ACTIVE' && (
          <Tooltip title="Редактировать">
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(d)} />
          </Tooltip>
        )}
        {canManage && d.status === 'ACTIVE' && d.payments.length === 0 && (
          <Popconfirm title="Удалить долг?" onConfirm={() => onDelete(d.id)} okText="Удалить" cancelText="Отмена">
            <Tooltip title="Удалить">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    ),
  },
];
