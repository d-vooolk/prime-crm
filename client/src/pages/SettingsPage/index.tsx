import React from 'react';
import { Badge, Button, Card, Grid } from 'antd';
import {
  AlertOutlined, AppstoreOutlined, ArrowLeftOutlined, BankOutlined, BulbOutlined, CarOutlined,
  ContactsOutlined, FallOutlined, FileTextOutlined, InboxOutlined, MessageOutlined, RightOutlined,
  RiseOutlined, SettingOutlined, ShareAltOutlined, SolutionOutlined, TeamOutlined, ToolOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import cn from 'classnames';
import { useAuthStore } from '@/store/authStore';
import { isEmployee, isManagerOrAbove } from '@/utils/roles';
import { useStockLowCount } from '@/hooks/useStock';
import { CarCatalogEditor } from '@/components/CarCatalogEditor';
import { ExpenseCategoriesEditor } from '@/components/ExpenseCategoriesEditor';
import { ClientSourcesEditor } from '@/components/ClientSourcesEditor';
import { ClientsPage } from '@/pages/ClientsPage';
import { ServicesTab } from '@/pages/ServicesPage/ServicesTab';
import { RepairTypesTab } from '@/pages/ServicesPage/RepairTypesTab';
import { EquipmentTab } from '@/pages/ServicesPage/EquipmentTab';
import { StockTab } from '@/pages/ServicesPage/StockTab';
import { EmployeesTab } from '@/pages/ServicesPage/EmployeesTab';
import { ReceptionistsTab } from '@/pages/ServicesPage/ReceptionistsTab';
import { BasicTab } from './BasicTab';
import { CompanyTab } from './CompanyTab';
import { AidProtocolTab } from './AidProtocolTab';
import { SmsTab } from './SmsTab';
import { TemplatesTab } from './TemplatesTab';
import { OpportunitiesTab } from './OpportunitiesTab';
import { MissedProfitTab } from './MissedProfitTab';
import styles from './SettingsPage.module.scss';

interface SettingsSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  /** Счётчик у пункта меню (товары склада на исходе) */
  badge?: number;
  children: React.ReactNode;
}

/**
 * Старые адреса: справочник был одной вкладкой со своими подвкладками (?tab=directory&sub=stock)
 */
function sectionKeyFromParams(params: URLSearchParams) {
  const tab = params.get('tab');
  return tab === 'directory' ? params.get('sub') || 'services' : tab;
}

/**
 * Настройки: слева вертикальное меню разделов (справочник — его пунктами), справа выбранный раздел.
 * На телефоне — сначала список разделов на весь экран, выбранный раздел тоже на весь экран
 * с кнопкой «Назад». Раздел — в адресе (?tab=): туда ведут старые ссылки /services и /clients.
 */
export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isSotrudnik = isEmployee(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = !Grid.useBreakpoint().md;
  const { data: lowStockCount = 0 } = useStockLowCount();

  const sections: SettingsSection[] = [
    { key: 'basic', label: 'Базовые', icon: <SettingOutlined />, group: 'Общие', children: <BasicTab /> },
    { key: 'company', label: 'Компания', icon: <BankOutlined />, group: 'Общие', children: <CompanyTab /> },
    { key: 'sms', label: 'SMS', icon: <MessageOutlined />, group: 'Общие', children: <SmsTab /> },
    { key: 'templates', label: 'Шаблоны документов', icon: <FileTextOutlined />, group: 'Общие', children: <TemplatesTab /> },
    // Справочник
    { key: 'services', label: 'Услуги', icon: <ToolOutlined />, group: 'Справочник', children: <ServicesTab /> },
    // Блоки страницы записи для клиента (zapis.prime-auto.by)
    { key: 'repairTypes', label: 'Типы ремонта', icon: <AppstoreOutlined />, group: 'Справочник', children: <RepairTypesTab /> },
    { key: 'equipment', label: 'Bi-Led модули', icon: <BulbOutlined />, group: 'Справочник', children: <EquipmentTab /> },
    {
      key: 'stock', label: 'Склад', icon: <InboxOutlined />, group: 'Справочник', badge: lowStockCount, children: <StockTab />,
    },
    {
      key: 'carCatalog',
      label: 'Справочник авто',
      icon: <CarOutlined />,
      group: 'Справочник',
      children: (
        <Card title="Марки, модели и поколения">
          <CarCatalogEditor />
        </Card>
      ),
    },
    {
      key: 'expenseCategories',
      label: 'Категории расходов',
      icon: <WalletOutlined />,
      group: 'Справочник',
      children: (
        <Card title="Категории расходов">
          <ExpenseCategoriesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    // Люди. Все профили — в «Сотрудниках»; мастера приёмщики — те, у кого включён свитч в карточке
    { key: 'employees', label: 'Сотрудники', icon: <TeamOutlined />, group: 'Люди', children: <EmployeesTab isMobile={isMobile} /> },
    {
      key: 'receptionists',
      label: 'Мастера приёмщики',
      icon: <SolutionOutlined />,
      group: 'Люди',
      children: <ReceptionistsTab isMobile={isMobile} />,
    },
    { key: 'clients', label: 'Клиенты', icon: <ContactsOutlined />, group: 'Люди', children: <ClientsPage /> },
    {
      key: 'clientSources',
      label: 'Источники клиентов',
      icon: <ShareAltOutlined />,
      group: 'Люди',
      children: (
        <Card title="Источники клиентов">
          <ClientSourcesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    // Допродажи в карточке записи, разделы вики для упущенной прибыли и тревожная кнопка —
    // только руководителям (сервер проверяет роль сам)
    ...(isManagerOrAbove(user)
      ? [
        { key: 'opportunities', label: 'Открытые возможности', icon: <RiseOutlined />, group: 'Руководителям', children: <OpportunitiesTab /> },
        { key: 'missedProfit', label: 'Упущенная прибыль', icon: <FallOutlined />, group: 'Руководителям', children: <MissedProfitTab /> },
        { key: 'aid', label: 'Протокол AID', icon: <AlertOutlined />, group: 'Руководителям', children: <AidProtocolTab /> },
      ]
      : []),
  ];

  const visible = isSotrudnik ? sections.filter(s => s.key === 'basic') : sections;
  const groups = [...new Set(visible.map(s => s.group))];
  // Один раздел (сотрудник) — меню не нужно
  const withMenu = visible.length > 1;
  const requestedKey = sectionKeyFromParams(searchParams);
  const requested = visible.find(s => s.key === requestedKey);
  // Телефон без выбранного раздела — меню; компьютер — первый раздел
  const active = requested ?? (isMobile && withMenu ? null : visible[0]);

  const open = (key: string) => {
    if (isMobile) {
      // Переход на телефоне — в историю: системная кнопка «Назад» тоже возвращает к меню
      setSearchParams({ tab: key }, { state: { fromMenu: true } });
    } else {
      setSearchParams(key === visible[0].key ? {} : { tab: key }, { replace: true });
    }
  };

  const back = () => {
    if ((location.state as { fromMenu?: boolean } | null)?.fromMenu) navigate(-1);
    else setSearchParams({}, { replace: true });
  };

  const menu = (
    <nav className={styles.menu}>
      {groups.map(group => (
        <div key={group} className={styles.group}>
          <div className={styles.groupTitle}>{group}</div>
          {visible.filter(s => s.group === group).map(s => (
            <button
              key={s.key}
              type="button"
              className={cn(styles.item, { [styles.itemActive]: !isMobile && s.key === active?.key })}
              onClick={() => open(s.key)}
            >
              <span className={styles.itemIcon}>{s.icon}</span>
              <span className={styles.itemLabel}>{s.label}</span>
              {!!s.badge && <Badge count={s.badge} size="small" color="var(--color-warning)" />}
              {isMobile && <RightOutlined className={styles.itemArrow} />}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );

  if (isMobile) {
    if (!active) {
      return (
        <div className={styles.page}>
          <h1 className={styles.title}>Настройки</h1>
          {menu}
        </div>
      );
    }
    return (
      <div className={styles.page}>
        {withMenu ? (
          <div className={styles.mobileHeader}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={back} aria-label="Назад к настройкам" />
            <h1 className={styles.mobileTitle}>{active.label}</h1>
          </div>
        ) : (
          <h1 className={styles.title}>Настройки</h1>
        )}
        {active.children}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки</h1>
      <div className={cn(styles.layout, { [styles.layoutWithMenu]: withMenu })}>
        {withMenu && <aside className={styles.aside}>{menu}</aside>}
        <div className={styles.content}>{active?.children}</div>
      </div>
    </div>
  );
};
