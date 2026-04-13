import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarOutlined,
  DashboardOutlined,
  TeamOutlined,
  ToolOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useUiStore } from '@/store/uiStore';
import styles from './SideBar.module.scss';
import cn from 'classnames';

const NAV_ITEMS = [
  { path: '/schedule', label: 'Расписание', icon: <CalendarOutlined /> },
  { path: '/dashboard', label: 'Дашборд', icon: <DashboardOutlined /> },
  { path: '/clients', label: 'Клиенты', icon: <TeamOutlined /> },
  { path: '/services', label: 'Услуги', icon: <ToolOutlined /> },
  { path: '/settings', label: 'Настройки', icon: <SettingOutlined /> },
];

export const SideBar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(styles.sidebar, { [styles.collapsed]: sidebarCollapsed })}
        style={{ width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      >
        <div className={cn(styles.logo, { [styles.collapsed]: sidebarCollapsed })}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🚗</span>
          <span>Prime CRM</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Tooltip
              key={item.path}
              title={sidebarCollapsed ? item.label : ''}
              placement="right"
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(styles.navItem, { [styles.active]: isActive })
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            </Tooltip>
          ))}
        </nav>

        <div className={styles.footer}>
          <button className={styles.collapseBtn} onClick={toggleSidebar}>
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(styles.bottomNavItem, { [styles.active]: isActive })
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
