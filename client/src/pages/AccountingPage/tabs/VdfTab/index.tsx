import React, { useState } from 'react';
import { Segmented, Table } from 'antd';
import { VdfOrder } from '@/api/accounting.api';
import { useVdfOrders } from '../../hooks/useAccountingData';
import { vdfColumns, VdfOrderItems } from '../../columns/vdfColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { VdfOrderModal, VdfOrderModalMode } from '../../modals/VdfOrderModal';
import shared from '../../shared.module.scss';
import styles from './VdfTab.module.scss';

/**
 * Заказы сотрудников из магазина vdf.by. Приходят, когда в магазине заказ отмечен «Выполнен»;
 * исполнение создаёт расход в кассе с категорией «vdf.by».
 */
export const VdfTab: React.FC = () => {
  const [showExecuted, setShowExecuted] = useState(false);
  const pending = useVdfOrders('PENDING', !showExecuted);
  const executed = useVdfOrders('EXECUTED', showExecuted);
  const current = showExecuted ? executed : pending;
  const [target, setTarget] = useState<{ order: VdfOrder; mode: VdfOrderModalMode } | null>(null);

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert errors={[current.error]} title="Не удалось загрузить заказы" onRetry={() => current.refetch()} />

      <div className={shared.topBar}>
        <Segmented
          value={showExecuted ? 'executed' : 'pending'}
          onChange={v => setShowExecuted(v === 'executed')}
          options={[
            { value: 'pending', label: 'Ожидают' },
            { value: 'executed', label: 'Исполненные' },
          ]}
        />
        {!showExecuted && (
          <span className={styles.hint}>Проверьте сумму и исполните — в кассе появится расход «vdf.by»</span>
        )}
      </div>

      <Table<VdfOrder>
        dataSource={current.data ?? []}
        rowKey="id"
        size="small"
        pagination={showExecuted ? { pageSize: 50, hideOnSinglePage: true } : false}
        loading={current.isLoading}
        locale={{ emptyText: showExecuted ? 'Исполненных пока нет' : 'Новых заказов нет' }}
        scroll={{ x: 900 }}
        expandable={{ expandedRowRender: order => <VdfOrderItems order={order} /> }}
        columns={vdfColumns({
          executed: showExecuted,
          onEditAmount: order => setTarget({ order, mode: 'amount' }),
          onExecute: order => setTarget({ order, mode: 'execute' }),
        })}
      />

      <VdfOrderModal order={target?.order ?? null} mode={target?.mode ?? 'execute'} onClose={() => setTarget(null)} />
    </div>
  );
};
