import React, { useState } from 'react';
import { Button, Card, Segmented, Statistic, Table } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { CapitalTransaction } from '@/types';
import { accountingApi } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { useCapital, useCapitalBalance, useInvalidateAccounting } from '../../hooks/useAccountingData';
import { capitalActionColumns, depositColumns, withdrawalColumns } from '../../columns/capitalColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { CapitalOperation, CapitalOperationModal } from '../../modals/CapitalOperationModal';
import { CapitalEditModal } from '../../modals/CapitalEditModal';
import shared from '../../shared.module.scss';

const EMPTY_BALANCE = { byn: 0, usd: 0, eur: 0 };

const balanceClass = (v: number) => cn(shared.stat, v >= 0 ? shared.statSuccess : shared.statError);

interface Props {
  /** Правка и удаление сумм — только создателю */
  canEdit: boolean;
}

/** Капитал: балансы по валютам, пополнения и списания */
export const CapitalTab: React.FC<Props> = ({ canEdit }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const capital = useCapital(true);
  const balanceQuery = useCapitalBalance(true);
  const [operation, setOperation] = useState<CapitalOperation | null>(null);
  // Пополнения и списания — по одной таблице на экран, переключателем
  const [view, setView] = useState<'deposits' | 'withdrawals'>('deposits');
  const [editingTx, setEditingTx] = useState<CapitalTransaction | null>(null);
  const balance = balanceQuery.data ?? EMPTY_BALANCE;

  // Удаляется только строка капитала — касса и долги не меняются
  const handleDelete = async (id: string) => {
    try {
      await accountingApi.deleteCapitalTransaction(id);
      invalidate('capital');
      notify.toast.success('Операция удалена');
    } catch (e) {
      notify.error(e, 'Не удалось удалить операцию');
    }
  };
  const actionColumns = capitalActionColumns(canEdit, setEditingTx, handleDelete);
  const deposits = capital.data?.deposits ?? [];
  const withdrawals = capital.data?.withdrawals ?? [];

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert
        errors={[capital.error, balanceQuery.error]}
        title="Не удалось загрузить капитал"
        onRetry={() => { capital.refetch(); balanceQuery.refetch(); }}
      />

      <div className={shared.topBar}>
        <div className={shared.balanceCards}>
          <Card size="small" className={shared.balanceCard}>
            <Statistic title="Баланс BYN" value={balance.byn} precision={2} suffix="р." className={balanceClass(balance.byn)} />
          </Card>
          <Card size="small" className={shared.balanceCard}>
            <Statistic title="Баланс USD" value={balance.usd} precision={2} prefix="$" className={balanceClass(balance.usd)} />
          </Card>
          <Card size="small" className={shared.balanceCard}>
            <Statistic title="Баланс EUR" value={balance.eur} precision={2} prefix="€" className={balanceClass(balance.eur)} />
          </Card>
        </div>
        <div className={shared.actions}>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setOperation('deposit')}>
            Внести
          </Button>
          <Button icon={<MinusOutlined />} danger onClick={() => setOperation('withdrawal')}>
            Списать
          </Button>
        </div>
      </div>

      <Segmented<'deposits' | 'withdrawals'>
        value={view}
        onChange={setView}
        className={shared.viewSwitch}
        options={[
          { value: 'deposits', label: `Пополнения · ${deposits.length}` },
          { value: 'withdrawals', label: `Списания · ${withdrawals.length}` },
        ]}
      />

      <div className={shared.tableBlock}>
        {view === 'deposits' ? (
          <Table<CapitalTransaction>
            key="deposits"
            dataSource={deposits}
            columns={[...depositColumns, ...actionColumns]}
            rowKey="id"
            size="small"
            pagination={false}
            loading={capital.isLoading}
            scroll={{ x: 350 }}
          />
        ) : (
          <Table<CapitalTransaction>
            key="withdrawals"
            dataSource={withdrawals}
            columns={[...withdrawalColumns, ...actionColumns]}
            rowKey="id"
            size="small"
            pagination={false}
            loading={capital.isLoading}
            // 350 было меньше суммы ширин колонок — «Цель» не помещалась
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      <CapitalOperationModal kind={operation} onClose={() => setOperation(null)} />
      <CapitalEditModal tx={editingTx} onClose={() => setEditingTx(null)} />
    </div>
  );
};
