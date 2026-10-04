import React from 'react';
import { Button, Select, Table, Tag, Tooltip } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { formatPrice } from '@/utils/formatters';
import { ItemRow, PaymentTotals, isSplit } from '../closeDeal.utils';
import styles from './ItemsTable.module.scss';

interface Props {
  items: ItemRow[];
  totals: PaymentTotals;
  /** Колонка сотрудников и разделение — только если есть исполнители */
  hasEmployees: boolean;
  employeeOptions: { value: string; label: string }[];
  onChangeServiceman: (itemId: string, name: string) => void;
  onOpenSplit: (row: ItemRow) => void;
  onCancelSplit: (itemId: string) => void;
}

/** Перечень работ: сумма, чистая прибыль и сотрудник по каждой позиции + итог с предоплатой */
export const ItemsTable: React.FC<Props> = ({
  items, totals, hasEmployees, employeeOptions, onChangeServiceman, onOpenSplit, onCancelSplit,
}) => {
  const columns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: ItemRow) => (
        <div className={styles.serviceCell}>
          <div>
            <div className={styles.serviceName}>{name}</div>
            <div className={styles.categoryName}>{row.categoryName}</div>
          </div>
          {hasEmployees && !row.isProduct && (
            <Tooltip title="Разделить между сотрудниками">
              <Button
                type="text"
                size="small"
                icon={<TeamOutlined className={cn(styles.splitIcon, { [styles.splitIconActive]: !!row.split?.length })} />}
                onClick={() => onOpenSplit(row)}
                className={styles.splitButton}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Сумма',
      key: 'total',
      width: 100,
      render: (_: unknown, row: ItemRow) => (
        <span className={styles.amount}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: 'Чистая прибыль',
      key: 'netProfit',
      width: 130,
      render: (_: unknown, row: ItemRow) =>
        row.isProduct
          ? <span className={styles.muted}>—</span>
          : <span className={cn(styles.amount, styles.profit)}>{formatPrice(row.netProfit)}</span>,
    },
    ...(hasEmployees ? [{
      title: 'Сотрудник',
      key: 'serviceman',
      width: 180,
      render: (_: unknown, row: ItemRow) => {
        if (row.isProduct) {
          return <Tag color="orange" className={styles.tag}>Товар</Tag>;
        }
        if (isSplit(row)) {
          return (
            <div className={styles.splitCell}>
              <Tooltip title={row.split!.map(s => `${s.name}: ${formatPrice(s.amount)}`).join(' / ')}>
                <Tag color="blue" className={cn(styles.tag, styles.clickable)}>
                  {row.split!.map(s => s.name).join(', ')}
                </Tag>
              </Tooltip>
              <Button
                type="text"
                size="small"
                className={styles.cancelSplit}
                onClick={() => onCancelSplit(row.itemId)}
              >
                ✕
              </Button>
            </div>
          );
        }
        return (
          <Select
            size="small"
            className={styles.select}
            value={row.servicemanName || undefined}
            placeholder="Сотрудник"
            onChange={(v: string) => onChangeServiceman(row.itemId, v)}
            options={employeeOptions}
          />
        );
      },
    }] : []),
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      rowKey="itemId"
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
      className={styles.table}
      footer={() => (
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Итого:</span>
            <span className={styles.totalValue}>{formatPrice(totals.total)}</span>
          </div>
          {totals.prepaidCash > 0 && (
            <div className={styles.prepaidRow}>
              <span>Предоплата (нал):</span>
              <span className={styles.prepaidValue}>− {formatPrice(totals.prepaidCash)}</span>
            </div>
          )}
          {totals.prepaidCard > 0 && (
            <div className={styles.prepaidRow}>
              <span>Предоплата (РС):</span>
              <span className={styles.prepaidValue}>− {formatPrice(totals.prepaidCard)}</span>
            </div>
          )}
          {totals.totalPrepaid > 0 && (
            <div className={cn(styles.totalRow, styles.dueRow)}>
              <span className={styles.dueLabel}>К оплате:</span>
              <span className={cn(styles.totalValue, styles.dueValue)}>{formatPrice(totals.remaining)}</span>
            </div>
          )}
        </div>
      )}
    />
  );
};
