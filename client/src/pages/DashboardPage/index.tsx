import React from 'react';
import { Tabs } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { canSeeAvgCard, canSeeExpenses, canSeeRevenue } from '@/utils/roles';
import { MainTab } from './MainTab';
import { EmployeesTab } from './EmployeesTab';
import { ExpensesTab } from './ExpensesTab';
import { SourcesTab } from './SourcesTab';
import styles from './DashboardPage.module.scss';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Дашборд</h1>
      </div>

      <Tabs
        items={[
          {
            key: 'main',
            label: 'Основные показатели',
            children: <MainTab canSeeRevenue={canSeeRevenue(user)} canSeeAvgCard={canSeeAvgCard(user)} />,
          },
          {
            key: 'employees',
            label: 'Сотрудники',
            children: <EmployeesTab />,
          },
          {
            key: 'sources',
            label: 'Каналы привлечения',
            children: <SourcesTab canSeeRevenue={canSeeRevenue(user)} />,
          },
          // Аналитика расходов — только создателю
          ...(canSeeExpenses(user) ? [{
            key: 'expenses',
            label: 'Расходы',
            children: <ExpensesTab />,
          }] : []),
        ]}
      />
    </div>
  );
};
