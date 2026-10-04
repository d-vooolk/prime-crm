import React from 'react';
import { Button, Popconfirm, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { accountingApi, SalaryPayment } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../../hooks/useAccountingData';
import { formatDate } from '../../../utils';
import styles from './SalaryPayments.module.scss';

interface Props {
  payments: SalaryPayment[];
  canDelete: boolean;
}

/** Выплаты (аванс/расчёт) за период */
export const SalaryPayments: React.FC<Props> = ({ payments, canDelete }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();

  if (payments.length === 0) return null;

  const handleDelete = async (id: string) => {
    try {
      await accountingApi.deleteSalaryPayment(id);
      notify.toast.success('Выплата удалена');
      // Вместе с выплатой удаляется расход наличных в кассе
      invalidate('salary', 'cash');
    } catch (e) {
      notify.error(e, 'Не удалось удалить выплату');
    }
  };

  return (
    <div className={styles.salaryPayments}>
      <div className={styles.title}>Выплаты за период</div>
      {payments.map(p => (
        <div key={p.id} className={styles.row}>
          <Tag color={p.type === 'ADVANCE' ? 'gold' : 'blue'} className={styles.tag}>
            {p.type === 'ADVANCE' ? 'Аванс' : 'Расчёт'}
          </Tag>
          <span className={styles.info}>
            {formatDate(p.date)}
            {p.person && <span className={styles.person}> · выдал {p.person}</span>}
          </span>
          <span className={styles.amount}>
            <strong>{formatPrice(p.amount)}</strong>
            {p.cardAmount > 0 && (
              <span className={styles.split}>
                {p.cashAmount > 0 ? `нал ${formatPrice(p.cashAmount)} · ` : ''}карта {formatPrice(p.cardAmount)}
              </span>
            )}
          </span>
          {canDelete && (
            <Popconfirm
              title="Удалить выплату?"
              description={p.cashAmount > 0 ? 'Расход в кассе тоже будет удалён' : undefined}
              onConfirm={() => handleDelete(p.id)}
              okText="Да"
              cancelText="Нет"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      ))}
    </div>
  );
};
