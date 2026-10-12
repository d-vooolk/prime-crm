import React from 'react';
import { Button, Card, Grid } from 'antd';
import {
  AlertOutlined, ArrowLeftOutlined, AppstoreOutlined, BankOutlined, CarOutlined, FallOutlined,
  FileTextOutlined, MessageOutlined, RightOutlined, RiseOutlined, SettingOutlined, ShareAltOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import cn from 'classnames';
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
import { OpportunitiesTab } from './OpportunitiesTab';
import { MissedProfitTab } from './MissedProfitTab';
import styles from './SettingsPage.module.scss';

interface SettingsSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  children: React.ReactNode;
}

/**
 * Настройки: слева вертикальное меню разделов, справа выбранный раздел.
 * На телефоне — сначала список разделов на весь экран, выбранный раздел тоже на весь экран
 * с кнопкой «Назад». Раздел — в адресе (?tab=): на «Справочник» ведут старые ссылки /services и /clients.
 */
export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const isSotrudnik = isEmployee(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = !Grid.useBreakpoint().md;

  const sections: SettingsSection[] = [
    { key: 'basic', label: 'Базовые', icon: <SettingOutlined />, group: 'Общие', children: <BasicTab /> },
    { key: 'company', label: 'Компания', icon: <BankOutlined />, group: 'Общие', children: <CompanyTab /> },
    { key: 'sms', label: 'SMS', icon: <MessageOutlined />, group: 'Общие', children: <SmsTab /> },
    { key: 'templates', label: 'Шаблоны документов', icon: <FileTextOutlined />, group: 'Общие', children: <TemplatesTab /> },
    // Бывшая страница «Справочник» со всеми её вкладками
    { key: 'directory', label: 'Справочник', icon: <AppstoreOutlined />, group: 'Справочники', children: <ServicesPage embedded /> },
    {
      key: 'expenseCategories',
      label: 'Категории расходов',
      icon: <WalletOutlined />,
      group: 'Справочники',
      children: (
        <Card title="Категории расходов">
          <ExpenseCategoriesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    {
      key: 'clientSources',
      label: 'Источники клиентов',
      icon: <ShareAltOutlined />,
      group: 'Справочники',
      children: (
        <Card title="Источники клиентов">
          <ClientSourcesEditor readOnly={isSotrudnik} />
        </Card>
      ),
    },
    {
      key: 'carCatalog',
      label: 'Справочник авто',
      icon: <CarOutlined />,
      group: 'Справочники',
      children: (
        <Card title="Марки, модели и поколения">
          <CarCatalogEditor />
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
  const requested = visible.find(s => s.key === searchParams.get('tab'));
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
