import React, { useState } from 'react';
import { Button, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { accountingApi, Debt } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { useDebts, useInvalidateAccounting } from '../../hooks/useAccountingData';
import { debtColumns } from '../../columns/debtColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { DebtCreateModal } from '../../modals/DebtCreateModal';
import { DebtEditModal } from '../../modals/DebtEditModal';
import { DebtPayModal } from '../../modals/DebtPayModal';
import shared from '../../shared.module.scss';

interface Props {
  /** Править и удалять долги — те же права, что и на капитал */
  canManage: boolean;
}

/** Долги: наши и нам, активные и архив */
export const DebtsTab: React.FC<Props> = ({ canManage }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [showArchive, setShowArchive] = useState(false);
  const active = useDebts(false, true);
  const archive = useDebts(true, true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Debt | null>(null);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);

  const current = showArchive ? archive : active;

  const handleDelete = async (id: string) => {
    try {
      await accountingApi.deleteDebt(id);
      notify.toast.success('Долг удалён');
      await invalidate('debts');
    } catch (e) {
      notify.error(e, 'Не удалось удалить долг');
    }
  };

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert errors={[current.error]} title="Не удалось загрузить долги" onRetry={() => current.refetch()} />

      <div className={shared.topBar}>
        <div className={shared.actions}>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>
            Добавить запись
          </Button>
          <Button onClick={() => setShowArchive(v => !v)}>
            {showArchive ? 'Активные' : 'Архив'}
          </Button>
        </div>
      </div>

      <Table<Debt>
        dataSource={current.data ?? []}
        rowKey="id"
        size="small"
        pagination={false}
        loading={current.isLoading}
        locale={{ emptyText: showArchive ? 'Архив пуст' : 'Долгов нет' }}
        scroll={{ x: 900 }}
        columns={debtColumns({ showArchive, canManage, onPay: setPayTarget, onEdit: setEditTarget, onDelete: handleDelete })}
      />

      <DebtCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <DebtEditModal debt={editTarget} onClose={() => setEditTarget(null)} />

      {payTarget && (
        <DebtPayModal debt={payTarget} onClose={() => setPayTarget(null)} onPaid={() => setPayTarget(null)} />
      )}
    </div>
  );
};
