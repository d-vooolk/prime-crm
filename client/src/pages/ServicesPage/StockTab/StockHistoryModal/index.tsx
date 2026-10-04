import React from 'react';
import { Modal, Table, Tag } from 'antd';
import { useStockMovements } from '@/hooks/useStock';
import type { StockItem, StockMovement } from '@/types';
import { formatDate, formatTime } from '@/utils/formatters';
import { formatQty } from '../stock.utils';
import styles from './StockHistoryModal.module.scss';

interface Props {
  item: StockItem | null;
  onClose: () => void;
}

const TYPE_TAG: Record<StockMovement['type'], { color: string; label: string }> = {
  IN: { color: 'green', label: 'Приход' },
  OUT: { color: 'orange', label: 'Расход' },
  ADJUST: { color: 'blue', label: 'Инвентаризация' },
};

/** История движений товара: кто, когда и сколько */
export const StockHistoryModal: React.FC<Props> = ({ item, onClose }) => {
  const { data = [], isLoading } = useStockMovements(item?.id ?? null);

  return (
    <Modal title={item ? `История: ${item.name}` : ''} open={!!item} onCancel={onClose} footer={null} width={720} destroyOnHidden>
      <Table<StockMovement>
        dataSource={data}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={data.length > 20 ? { pageSize: 20, size: 'small' } : false}
        scroll={{ x: 560 }}
        locale={{ emptyText: 'Движений нет' }}
        columns={[
          {
            title: 'Дата', key: 'date', width: 120,
            render: (_, m) => `${formatDate(m.createdAt)} ${formatTime(m.createdAt)}`,
          },
          {
            title: 'Операция', key: 'type', width: 130,
            render: (_, m) => <Tag color={TYPE_TAG[m.type].color}>{TYPE_TAG[m.type].label}</Tag>,
          },
          {
            title: 'Изменение', key: 'delta', width: 100,
            render: (_, m) => (
              <span className={m.delta >= 0 ? styles.plus : styles.minus}>
                {m.delta > 0 ? '+' : ''}{formatQty(m.delta)}
              </span>
            ),
          },
          { title: 'Остаток', key: 'after', width: 90, render: (_, m) => formatQty(m.quantityAfter) },
          { title: 'Кто', dataIndex: 'userName', key: 'user', width: 130, render: (v?: string | null) => v || '—' },
          { title: 'Комментарий', dataIndex: 'comment', key: 'comment', render: (v?: string | null) => v || '—' },
        ]}
      />
    </Modal>
  );
};
