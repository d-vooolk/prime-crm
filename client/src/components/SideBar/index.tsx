import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  DashboardOutlined,
  TeamOutlined,
  ToolOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Calendar, ConfigProvider, Button, Popconfirm, Tooltip } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/Logo';
import styles from './SideBar.module.scss';
import cn from 'classnames';

dayjs.locale('ru');

const NAV_ITEMS = [
  { path: '/schedule', label: 'Расписание', icon: <CalendarOutlined /> },
  { path: '/dashboard', label: 'Дашборд', icon: <DashboardOutlined /> },
  { path: '/clients', label: 'Клиенты', icon: <TeamOutlined /> },
  { path: '/services', label: 'Справочник', icon: <ToolOutlined /> },
  { path: '/settings', label: 'Настройки', icon: <SettingOutlined /> },
];

export const SideBar: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const { user, logout } = useAuthStore();
  const visibleNavItems = user?.role === 'Сотрудник'
    ? NAV_ITEMS.filter(i => i.path === '/schedule')
    : NAV_ITEMS;
  const navigate = useNavigate();
  const location = useLocation();
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs(selectedDate));

  useEffect(() => {
    setCalendarValue(dayjs(selectedDate));
  }, [selectedDate]);

  const prevMonth = () => setCalendarValue(v => v.subtract(1, 'month'));
  const nextMonth = () => setCalendarValue(v => v.add(1, 'month'));

  const goToToday = () => {
    const today = dayjs();
    setCalendarValue(today);
    setSelectedDate(today.format('YYYY-MM-DD'));
    if (location.pathname !== '/schedule') navigate('/schedule');
  };

  const handleDateSelect = (date: Dayjs) => {
    setCalendarValue(date);
    setSelectedDate(date.format('YYYY-MM-DD'));
    if (location.pathname !== '/schedule') navigate('/schedule');
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Logo className={styles.logoSvg} />
        </div>

        <div className={styles.calendarWrap}>
          <ConfigProvider theme={{ components: { Calendar: { colorBgContainer: 'transparent' } } }}>
            <Calendar
              fullscreen={false}
              value={calendarValue}
              onChange={handleDateSelect}
              headerRender={({ value }) => (
                <div className={styles.calendarHeader}>
                  <button className={styles.calendarArrow} onClick={prevMonth}>
                    <LeftOutlined />
                  </button>
                  <span className={styles.calendarTitle}>
                    {value.locale('ru').format('MMMM YYYY')}
                  </span>
                  <button className={styles.calendarArrow} onClick={nextMonth}>
                    <RightOutlined />
                  </button>
                </div>
              )}
            />
          </ConfigProvider>
          <div className={styles.todayBtn}>
            <Button onClick={goToToday} block>Сегодня</Button>
          </div>
        </div>

        <nav className={styles.nav}>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(styles.navItem, { [styles.active]: isActive })
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name}</div>
            {user?.role && <div className={styles.userRole}>{user.role}</div>}
          </div>
          <Popconfirm
            title="Выйти из системы?"
            onConfirm={handleLogout}
            okText="Выйти"
            cancelText="Отмена"
            placement="topRight"
          >
            <Tooltip title="Выйти">
              <button className={styles.logoutBtn}>
                <LogoutOutlined />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      </aside>

      <nav className={styles.bottomNav}>
        {visibleNavItems.map((item) => (
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
