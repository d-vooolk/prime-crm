import React, { useState } from 'react';
import { Grid, Tabs } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useAuthStore } from '@/store/authStore';
import {
  canEditTransactions as canEditTransactionsFor,
  canSeeCapital as canSeeCapitalFor,
  canSeeCashflow as canSeeCashflowFor,
  canSeeClientName as canSeeClientNameFor,
} from '@/utils/roles';
import { CashflowTab } from './tabs/CashflowTab';
import { IncomeRsTab } from './tabs/IncomeRsTab';
import { DebtsTab } from './tabs/DebtsTab';
import { CapitalTab } from './tabs/CapitalTab';
import { SalaryTab } from './tabs/SalaryTab';
import { FounderSalaryTab } from './tabs/FounderSalaryTab';
import { StatsTab } from './tabs/StatsTab';
import styles from './AccountingPage.module.scss';

/**
 * Бухгалтерия. Каждая вкладка грузит свои данные сама (hooks/useAccountingData),
 * связи между вкладками — через инвалидацию ключей react-query после изменений.
 */
export const AccountingPage: React.FC = () => {
  const { user } = useAuthStore();
  const isMobile = !Grid.useBreakpoint().md;
  const canSeeCashflow = canSeeCashflowFor(user);
  const canSeeCapital = canSeeCapitalFor(user);
  const canEditTransactions = canEditTransactionsFor(user);

  // Месяц общий для приходно-расходной вкладки и прихода РС
  const [cashMonth, setCashMonth] = useState<Dayjs>(dayjs());

  const tabItems = [
    ...(canSeeCashflow ? [
      {
        key: 'cashflow',
        label: 'Приходно-Расходный',
        children: <CashflowTab month={cashMonth} onMonthChange={setCashMonth} canEditTransactions={canEditTransactions} />,
      },
      {
        key: 'incomers',
        label: 'Приход РС',
        children: <IncomeRsTab month={cashMonth} onMonthChange={setCashMonth} canEditTransactions={canEditTransactions} />,
      },
      { key: 'debts', label: 'Долги', children: <DebtsTab canManage={canSeeCapital} /> },
    ] : []),
    ...(canSeeCapital ? [{ key: 'capital', label: 'Капитал', children: <CapitalTab /> }] : []),
    {
      key: 'salary',
      label: 'Расчёт ЗП',
      children: (
        <SalaryTab
          user={user}
          isMobile={isMobile}
          canSeeCashflow={canSeeCashflow}
          canSeeClientName={canSeeClientNameFor(user)}
        />
      ),
    },
    ...(canSeeCapital ? [
      { key: 'founderSalary', label: 'ЗП Учредителей', children: <FounderSalaryTab /> },
      { key: 'stats', label: 'Статистика', children: <StatsTab /> },
    ] : []),
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Бухгалтерия</h1>
      <Tabs items={tabItems} />
    </div>
  );
};
