import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  DashboardOutlined,
  TeamOutlined,
  ToolOutlined,
  SettingOutlined,
  AccountBookOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Calendar, ConfigProvider, Button } from 'antd';
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
  { path: '/accounting', label: 'Бухгалтерия', icon: <AccountBookOutlined /> },
  { path: '/settings', label: 'Настройки', icon: <SettingOutlined /> },
];

export const SideBar: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const { user } = useAuthStore();
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (user?.role === 'Сотрудник') {
      return item.path === '/schedule' || item.path === '/accounting' || item.path === '/settings';
    }
    return true;
  });
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

  return (
    <>
      <div className={styles.mobileHeader}>
        <Logo className={styles.mobileHeaderLogo} />
      </div>

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
