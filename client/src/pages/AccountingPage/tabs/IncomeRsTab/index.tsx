import React from 'react';
import { DatePicker, Table } from 'antd';
import { Dayjs } from 'dayjs';
import { CashTransaction } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useCashMonth } from '../../hooks/useAccountingData';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { incomeRsColumns } from '../../columns/cashColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import shared from '../../shared.module.scss';

interface Props {
  month: Dayjs;
  onMonthChange: (month: Dayjs) => void;
  canEditTransactions: boolean;
}

/** Приход по расчётному счёту за месяц (месяц общий с приходно-расходной вкладкой) */
export const IncomeRsTab: React.FC<Props> = ({ month, onMonthChange, canEditTransactions }) => {
  const cash = useCashMonth(month, true);
  const { actionColumns, editModal } = useTransactionActions(canEditTransactions);

  const incomeRs = cash.data?.incomeRs ?? [];
  const total = incomeRs.reduce((s, r) => s + r.amount, 0);

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert errors={[cash.error]} title="Не удалось загрузить приход РС" onRetry={() => cash.refetch()} />

      <div className={shared.topBar}>
        <DatePicker
          picker="month"
          value={month}
          onChange={v => v && onMonthChange(v)}
          format="MMMM YYYY"
          allowClear={false}
          className={shared.monthSelect}
        />
      </div>

      <div className={shared.tablesGrid}>
        <div className={shared.tableSection}>
          <div className={shared.tableTitle}>Приход РС</div>
          <div className={shared.tableBlock}>
            <Table<CashTransaction>
              dataSource={incomeRs}
              columns={[...incomeRsColumns, ...actionColumns]}
              rowKey="id"
              size="small"
              pagination={false}
              loading={cash.isLoading}
              scroll={{ x: 700 }}
              footer={() => <div className={shared.tableTotal}>Итого: {formatPrice(total)}</div>}
            />
          </div>
        </div>
      </div>

      {editModal}
    </div>
  );
};
