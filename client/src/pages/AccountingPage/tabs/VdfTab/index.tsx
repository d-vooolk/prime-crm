import React, { useState } from 'react';
import { Segmented, Table } from 'antd';
import { VdfOrder, vdfOrdersApi, VdfOrderStatus } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { formatMoney, plural } from '@/utils/formatters';
import { useInvalidateAccounting, useVdfOrders } from '../../hooks/useAccountingData';
import { vdfColumns, VdfOrderItems } from '../../columns/vdfColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { vdfTotals } from '../../utils';
import { VdfOrderModal, VdfOrderModalMode } from '../../modals/VdfOrderModal';
import shared from '../../shared.module.scss';
import styles from './VdfTab.module.scss';

const LIST_LIMIT = 200;

const VdfTotalsFooter: React.FC<{ orders: VdfOrder[]; view: VdfOrderStatus }> = ({ orders, view }) => {
  const totals = vdfTotals(orders);
  const pending = view === 'PENDING';
  return (
    <div className={shared.tableTotal}>
      <div>
        Итого: {totals.count} {plural(totals.count, ['заказ', 'заказа', 'заказов'])} на {formatMoney(totals.amount)}
        {!pending && totals.count >= LIST_LIMIT && ` (последние ${LIST_LIMIT})`}
        {pending && totals.paid > 0 && (
          <> · оплачено {formatMoney(totals.paid)} · осталось {formatMoney(totals.remaining)}</>
        )}
      </div>
      {pending && totals.byEmployee.length > 1 && (
        <div className={styles.byEmployee}>
          {totals.byEmployee.map(e => `${e.name} — ${formatMoney(e.remaining)}`).join(' · ')}
        </div>
      )}
    </div>
  );
};

const EMPTY_TEXT: Record<VdfOrderStatus, string> = {
  PENDING: 'Новых заказов нет',
  EXECUTED: 'Исполненных пока нет',
  CANCELLED: 'Отменённых нет',
};

/**
 * Заказы сотрудников из магазина vdf.by. Приходят, когда в магазине заказ отмечен «Выполнен»;
 * исполнение создаёт расход в кассе с категорией «vdf.by», отмена сообщает магазину, что оплаты не будет.
 */
export const VdfTab: React.FC = () => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [view, setView] = useState<VdfOrderStatus>('PENDING');
  const pending = useVdfOrders('PENDING', view === 'PENDING');
  const executed = useVdfOrders('EXECUTED', view === 'EXECUTED');
  const cancelled = useVdfOrders('CANCELLED', view === 'CANCELLED');
  const current = view === 'EXECUTED' ? executed : view === 'CANCELLED' ? cancelled : pending;
  const [target, setTarget] = useState<{ order: VdfOrder; mode: VdfOrderModalMode } | null>(null);

  const restore = async (order: VdfOrder) => {
    try {
      await vdfOrdersApi.restore(order.id);
      notify.toast.success('Заказ снова ждёт исполнения');
      invalidate('vdfOrders');
    } catch (e) {
      notify.error(e, 'Не удалось вернуть заказ');
    }
  };

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert errors={[current.error]} title="Не удалось загрузить заказы" onRetry={() => current.refetch()} />

      <div className={shared.topBar}>
        <Segmented<VdfOrderStatus>
          value={view}
          onChange={setView}
          options={[
            { value: 'PENDING', label: 'Ожидают' },
            { value: 'EXECUTED', label: 'Исполненные' },
            { value: 'CANCELLED', label: 'Отменённые' },
          ]}
        />
        {view === 'PENDING' && (
          <span className={styles.hint}>Проверьте сумму и исполните — в кассе появится расход «vdf.by»</span>
        )}
      </div>

      <Table<VdfOrder>
        dataSource={current.data ?? []}
        rowKey="id"
        size="small"
        pagination={view === 'PENDING' ? false : { pageSize: 50, hideOnSinglePage: true }}
        loading={current.isLoading}
        locale={{ emptyText: EMPTY_TEXT[view] }}
        scroll={{ x: 900 }}
        expandable={{ expandedRowRender: order => <VdfOrderItems order={order} /> }}
        footer={current.data?.length ? () => <VdfTotalsFooter orders={current.data ?? []} view={view} /> : undefined}
        columns={vdfColumns({
          view,
          onEditAmount: order => setTarget({ order, mode: 'amount' }),
          onExecute: order => setTarget({ order, mode: 'execute' }),
          onCancel: order => setTarget({ order, mode: 'cancel' }),
          onRestore: restore,
        })}
      />

      <VdfOrderModal order={target?.order ?? null} mode={target?.mode ?? 'execute'} onClose={() => setTarget(null)} />
    </div>
  );
};
