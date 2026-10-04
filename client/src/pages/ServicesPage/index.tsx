import React from 'react';
import { Badge, Grid, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { ClientsPage } from '@/pages/ClientsPage';
import { ServicesTab } from './ServicesTab';
import { EquipmentTab } from './EquipmentTab';
import { EmployeesTab } from './EmployeesTab';
import { ReceptionistsTab } from './ReceptionistsTab';
import { StockTab } from './StockTab';
import { useStockLowCount } from '@/hooks/useStock';
import styles from './ServicesPage.module.scss';

interface Props {
  /** Справочник открыт вкладкой в настройках — без собственного заголовка и отступов страницы */
  embedded?: boolean;
}

export const ServicesPage: React.FC<Props> = ({ embedded = false }) => {
  const isMobile = !Grid.useBreakpoint().md;
  const { data: lowCount = 0 } = useStockLowCount();
  // ?sub=stock — открыть сразу склад (ссылка из напоминания в расписании)
  const [searchParams] = useSearchParams();

  return (
    <div className={embedded ? undefined : styles.page}>
      {!embedded && (
        <div className={styles.header}>
          <h1 className={styles.title}>Справочник</h1>
        </div>
      )}

      <Tabs
        defaultActiveKey={searchParams.get('sub') ?? undefined}
        items={[
          { key: 'services', label: 'Услуги', children: <ServicesTab /> },
          { key: 'equipment', label: 'Bi-Led модули', children: <EquipmentTab /> },
          {
            key: 'stock',
            label: <Badge count={lowCount} size="small" offset={[8, -2]} color="var(--color-warning)">Склад</Badge>,
            children: <StockTab />,
          },
          // Все профили живут во вкладке «Сотрудники»; мастера приёмщики — те, у кого включён свитч в карточке
          { key: 'employees', label: 'Сотрудники', children: <EmployeesTab isMobile={isMobile} /> },
          { key: 'clients', label: 'Клиенты', children: <ClientsPage /> },
          { key: 'receptionists', label: 'Мастера приёмщики', children: <ReceptionistsTab isMobile={isMobile} /> },
        ]}
      />
    </div>
  );
};
