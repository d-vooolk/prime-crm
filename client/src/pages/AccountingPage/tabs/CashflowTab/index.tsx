import React, { useState } from 'react';
import { Button, Card, DatePicker, Statistic, Table } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { Dayjs } from 'dayjs';
import { CashTransaction } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useCashBalance, useCashMonth } from '../../hooks/useAccountingData';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { usePersons } from '../../hooks/usePersons';
import { expenseColumns, incomeColumns } from '../../columns/cashColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { ExpenseModal } from '../../modals/ExpenseModal';
import { ManualIncomeModal } from '../../modals/ManualIncomeModal';
import { CapitalTransferModal } from '../../modals/CapitalTransferModal';
import shared from '../../shared.module.scss';

interface Props {
  month: Dayjs;
  onMonthChange: (month: Dayjs) => void;
  canEditTransactions: boolean;
}

/** Приходно-расходный: баланс наличных, приход и расход за месяц */
export const CashflowTab: React.FC<Props> = ({ month, onMonthChange, canEditTransactions }) => {
  const cash = useCashMonth(month, true);
  const balanceQuery = useCashBalance(true);
  const { actionColumns, editModal } = useTransactionActions(canEditTransactions);
  const { defaultPerson, managerServicemen } = usePersons();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [manualIncomeOpen, setManualIncomeOpen] = useState(false);
  const [capitalTransferOpen, setCapitalTransferOpen] = useState(false);

  const income = cash.data?.income ?? [];
  const expenses = cash.data?.expenses ?? [];
  const balance = balanceQuery.data ?? 0;
  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert
        errors={[cash.error, balanceQuery.error]}
        title="Не удалось загрузить кассу"
        onRetry={() => { cash.refetch(); balanceQuery.refetch(); }}
      />

      <div className={shared.topBar}>
        <Card size="small" className={shared.balanceCard}>
          <Statistic
            title="Баланс (наличные)"
            value={balance}
            precision={2}
            suffix="р."
            className={cn(shared.stat, balance >= 0 ? shared.statSuccess : shared.statError)}
          />
        </Card>

        <DatePicker
          picker="month"
          value={month}
          onChange={v => v && onMonthChange(v)}
          format="MMMM YYYY"
          allowClear={false}
          className={shared.monthSelect}
        />

        <div className={shared.actions}>
          <Button icon={<MinusOutlined />} danger onClick={() => setExpenseOpen(true)}>
            Изъять средства
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setManualIncomeOpen(true)}>
            Ввод средств
          </Button>
        </div>
      </div>

      <div className={shared.tablesGrid}>
        <div className={shared.tableSection}>
          <div className={shared.tableTitle}>Приход (наличные)</div>
          <div className={shared.tableBlock}>
            <Table<CashTransaction>
              dataSource={income}
              columns={[...incomeColumns, ...actionColumns]}
              rowKey="id"
              size="small"
              pagination={false}
              loading={cash.isLoading}
              scroll={{ x: 700 }}
              footer={() => <div className={shared.tableTotal}>Итого: {formatPrice(incomeTotal)}</div>}
            />
          </div>
        </div>

        <div className={shared.tableSection}>
          <div className={shared.tableTitle}>Расход</div>
          <div className={shared.tableBlock}>
            <Table<CashTransaction>
              dataSource={expenses}
              columns={[...expenseColumns, ...actionColumns]}
              rowKey="id"
              size="small"
              pagination={false}
              loading={cash.isLoading}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      </div>

      {editModal}

      <ExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onCapitalTransfer={() => {
          setExpenseOpen(false);
          setCapitalTransferOpen(true);
        }}
      />

      <ManualIncomeModal open={manualIncomeOpen} onClose={() => setManualIncomeOpen(false)} />

      {capitalTransferOpen && (
        <CapitalTransferModal
          open
          onClose={() => setCapitalTransferOpen(false)}
          onDone={() => setCapitalTransferOpen(false)}
          persons={managerServicemen.map(m => m.name)}
          defaultPerson={defaultPerson}
        />
      )}
    </div>
  );
};
