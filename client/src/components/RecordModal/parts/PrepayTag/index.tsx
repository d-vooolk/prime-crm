import React from 'react';
import { Tag } from 'antd';
import { formatMoney, formatPrice } from '@/utils/formatters';
import { SelectedService } from '../../types';
import styles from './PrepayTag.module.scss';

/** Метка внесённой предоплаты по позиции */
export const PrepayTag: React.FC<{ row: SelectedService }> = ({ row }) => {
  const paid = row.prepaidAmount || 0;
  if (paid <= 0) return null;
  if (paid >= row.price * row.quantity) {
    return <Tag color="success" className={styles.tag}>Оплачено полностью</Tag>;
  }
  return (
    <Tag color="processing" className={styles.tag}>
      Предоплата {formatPrice(paid)}
      {row.prepaidCurrency && row.prepaidCurrencyAmount ? ` (${formatMoney(row.prepaidCurrencyAmount, row.prepaidCurrency)})` : ''}
    </Tag>
  );
};
