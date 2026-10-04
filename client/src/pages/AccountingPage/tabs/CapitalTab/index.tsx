import React, { useState } from 'react';
import { Button, Card, Statistic, Table } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { CapitalTransaction } from '@/types';
import { useCapital, useCapitalBalance } from '../../hooks/useAccountingData';
import { depositColumns, withdrawalColumns } from '../../columns/capitalColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { CapitalOperation, CapitalOperationModal } from '../../modals/CapitalOperationModal';
import shared from '../../shared.module.scss';

const EMPTY_BALANCE = { byn: 0, usd: 0, eur: 0 };

const balanceClass = (v: number) => cn(shared.stat, v >= 0 ? shared.statSuccess : shared.statError);

/** Капитал: балансы по валютам, пополнения и списания */
export const CapitalTab: React.FC = () => {
  const capital = useCapital(true);
  const balanceQuery = useCapitalBalance(true);
  const [operation, setOperation] = useState<CapitalOperation | null>(null);
  const balance = balanceQuery.data ?? EMPTY_BALANCE;

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

      <div className={shared.tablesGrid}>
        <div className={shared.tableSection}>
          <div className={shared.tableTitle}>Пополнения</div>
          <div className={shared.tableBlock}>
            <Table<CapitalTransaction>
              dataSource={capital.data?.deposits ?? []}
              columns={depositColumns}
              rowKey="id"
              size="small"
              pagination={false}
              loading={capital.isLoading}
              scroll={{ x: 350 }}
            />
          </div>
        </div>
        <div className={shared.tableSection}>
          <div className={shared.tableTitle}>Списания</div>
          <div className={shared.tableBlock}>
            <Table<CapitalTransaction>
              dataSource={capital.data?.withdrawals ?? []}
              columns={withdrawalColumns}
              rowKey="id"
              size="small"
              pagination={false}
              loading={capital.isLoading}
              // 350 было меньше суммы ширин колонок — «Цель» не помещалась
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      </div>

      <CapitalOperationModal kind={operation} onClose={() => setOperation(null)} />
    </div>
  );
};
