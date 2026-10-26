import React, { useState } from 'react';
import { Button, Card, DatePicker, Segmented, Statistic, Table } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { Dayjs } from 'dayjs';
import { CashTransaction } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { useCashBalance, useCashMonth, useSalaryFund } from '../../hooks/useAccountingData';
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
  const fundQuery = useSalaryFund(true);
  const { actionColumns, editModal } = useTransactionActions(canEditTransactions);
  const { defaultPerson, managerServicemen } = usePersons();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [manualIncomeOpen, setManualIncomeOpen] = useState(false);
  const [capitalTransferOpen, setCapitalTransferOpen] = useState(false);
  // Приход и расход — по одной таблице на экран, переключателем
  const [view, setView] = useState<'income' | 'expenses'>('income');

  const income = cash.data?.income ?? [];
  const expenses = cash.data?.expenses ?? [];
  const balance = balanceQuery.data ?? 0;
  const fund = fundQuery.data;
  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const expensesTotal = expenses.reduce((s, r) => s + r.amount, 0);

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert
        errors={[cash.error, balanceQuery.error, fundQuery.error]}
        title="Не удалось загрузить кассу"
        onRetry={() => { cash.refetch(); balanceQuery.refetch(); fundQuery.refetch(); }}
      />

      <div className={shared.topBar}>
        <div className={shared.balanceCards}>
          <Card size="small" className={shared.balanceCard}>
            <Statistic
              title="Баланс (наличные)"
              value={balance}
              precision={2}
              suffix="р."
              className={cn(shared.stat, balance >= 0 ? shared.statSuccess : shared.statError)}
            />
          </Card>

          {/* Сколько ещё выдать сотрудникам за текущий период: начислено минус уже выданное */}
          <Card size="small" className={shared.balanceCard}>
            <Statistic
              title="Зарплатный фонд"
              value={fund?.remaining ?? 0}
              precision={2}
              suffix="р."
              loading={fundQuery.isLoading}
              className={cn(shared.stat, shared.statWarning)}
            />
          </Card>
        </div>

        <DatePicker
          picker="month"
          value={month}
          onChange={v => v && onMonthChange(v)}
          format="MMMM YYYY"
          allowClear={false}
          className={cn(shared.monthSelect, shared.monthSelectWide)}
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

      <Segmented<'income' | 'expenses'>
        value={view}
        onChange={setView}
        className={shared.viewSwitch}
        options={[
          { value: 'income', label: `Приход (наличные) · ${income.length}` },
          { value: 'expenses', label: `Расход · ${expenses.length}` },
        ]}
      />

      <div className={shared.tableBlock}>
        {view === 'income' ? (
          <Table<CashTransaction>
            key="income"
            dataSource={income}
            columns={[...incomeColumns, ...actionColumns]}
            rowKey="id"
            size="small"
            pagination={false}
            loading={cash.isLoading}
            scroll={{ x: 700 }}
            footer={() => <div className={shared.tableTotal}>Итого: {formatPrice(incomeTotal)}</div>}
          />
        ) : (
          <Table<CashTransaction>
            key="expenses"
            dataSource={expenses}
            columns={[...expenseColumns, ...actionColumns]}
            rowKey="id"
            size="small"
            pagination={false}
            loading={cash.isLoading}
            scroll={{ x: 'max-content' }}
            footer={() => <div className={shared.tableTotal}>Итого: {formatPrice(expensesTotal)}</div>}
          />
        )}
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
