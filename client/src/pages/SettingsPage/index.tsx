import React from 'react';
import { Card, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { isEmployee, isManagerOrAbove } from '@/utils/roles';
import { CarCatalogEditor } from '@/components/CarCatalogEditor';
import { ExpenseCategoriesEditor } from '@/components/ExpenseCategoriesEditor';
import { ClientSourcesEditor } from '@/components/ClientSourcesEditor';
import { ServicesPage } from '@/pages/ServicesPage';
import { BasicTab } from './BasicTab';
import { CompanyTab } from './CompanyTab';
import { AidProtocolTab } from './AidProtocolTab';
import { SmsTab } from './SmsTab';
import { TemplatesTab } from './TemplatesTab';
import styles from './SettingsPage.module.scss';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isSotrudnik = isEmployee(user);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabItems = [
    { key: 'basic', label: 'Базовые', children: <BasicTab /> },
    { key: 'company', label: 'Компания', children: <CompanyTab /> },
    { key: 'sms', label: 'SMS', children: <SmsTab /> },
    { key: 'templates', label: 'Шаблоны документов', children: <TemplatesTab /> },
    // Бывшая страница «Справочник» со всеми её вкладками
    { key: 'directory', label: 'Справочник', children: <ServicesPage embedded /> },
    {
      key: 'expenseCategories',
      label: 'Категории расходов',
      children: (
        <Card title="Категории расходов">
          <ExpenseCategoriesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    {
      key: 'clientSources',
      label: 'Источники клиентов',
      children: (
        <Card title="Источники клиентов">
          <ClientSourcesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    {
      key: 'carCatalog',
      label: 'Справочник авто',
      children: (
        <Card title="Марки, модели и поколения">
          <CarCatalogEditor />
        </Card>
      ),
    },
    // Тревожная кнопка — только руководителям (сервер проверяет роль сам)
    ...(isManagerOrAbove(user)
      ? [{ key: 'aid', label: 'Протокол AID', children: <AidProtocolTab /> }]
      : []),
  ];

  const visibleTabItems = isSotrudnik ? tabItems.filter(t => t.key === 'basic') : tabItems;
  // Вкладка — в адресе: на «Справочник» ведут старые ссылки /services и /clients
  const requestedTab = searchParams.get('tab');
  const activeTab = visibleTabItems.find(t => t.key === requestedTab)?.key ?? visibleTabItems[0].key;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки</h1>

      <Tabs
        items={visibleTabItems}
        activeKey={activeTab}
        onChange={key => setSearchParams(key === visibleTabItems[0].key ? {} : { tab: key }, { replace: true })}
      />
    </div>
  );
};
