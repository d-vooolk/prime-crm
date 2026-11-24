import React from 'react';
import { Button, Popconfirm, Tag, Tooltip } from 'antd';
import { DeleteOutlined, RetweetOutlined } from '@ant-design/icons';
import cn from 'classnames';
import dayjs from 'dayjs';
import { accountingApi, SalaryAdjustment } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../../hooks/useAccountingData';
import styles from './SalaryAdjustments.module.scss';

interface Props {
  adjustments: SalaryAdjustment[];
  canDelete: boolean;
  /** Перенос в расчёт другого месяца — как у работ по записям */
  canTransfer: boolean;
  onTransfer: (adjustment: SalaryAdjustment) => void;
}

const monthLabel = (m: { year: number; month: number }) => dayjs().year(m.year).month(m.month - 1).format('MMMM YYYY');

/** Штрафы и премии за период */
export const SalaryAdjustments: React.FC<Props> = ({ adjustments, canDelete, canTransfer, onTransfer }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();

  if (adjustments.length === 0) return null;

  const handleDelete = async (id: string) => {
    try {
      await accountingApi.deleteAdjustment(id);
    } catch (e) {
      // Раньше ошибка глоталась и штраф молча оставался в расчёте
      notify.error(e, 'Не удалось удалить');
    }
    invalidate('salary');
  };

  return (
    <div className={styles.list}>
      {adjustments.map(adj => {
        const isFine = adj.type === 'FINE';
        return (
          <div key={adj.id} className={cn(styles.row, isFine ? styles.fine : styles.bonus)}>
            <Tag color={isFine ? 'red' : 'green'} className={styles.tag}>
              {isFine ? 'Штраф' : 'Премия'}
            </Tag>
            <span className={styles.reason}>
              {adj.reason}
              {adj.transferredFrom && (
                <span className={styles.transferredFrom}> · перенесено из {monthLabel(adj.transferredFrom)}</span>
              )}
            </span>
            <strong className={isFine ? styles.fineAmount : styles.bonusAmount}>
              {isFine ? '−' : '+'}{formatPrice(adj.amount)}
            </strong>
            {canTransfer && (
              <Tooltip title={adj.transferredFrom ? `Перенесено из ${monthLabel(adj.transferredFrom)} — изменить` : 'Перенести в другой месяц'}>
                <Button
                  type="text"
                  size="small"
                  aria-label="Перенести в другой месяц"
                  icon={<RetweetOutlined className={adj.transferredFrom ? styles.transferred : undefined} />}
                  onClick={() => onTransfer(adj)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm title="Удалить?" onConfirm={() => handleDelete(adj.id)} okText="Да" cancelText="Нет">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </div>
        );
      })}
    </div>
  );
};
