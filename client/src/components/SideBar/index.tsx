import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LeftOutlined, RightOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Calendar, ConfigProvider, Button, Badge } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useWikiStore } from '@/store/wikiStore';
import { Logo } from '@/components/Logo';
import { recordsApi } from '@/api/records.api';
import { canSeeMail, canSeePath, canSeeSiteLeads, isManagerOrAbove } from '@/utils/roles';
import { useStockLowCount } from '@/hooks/useStock';
import { useMailUnreadCount } from '@/hooks/useMail';
import { useSiteLeadsNewCount } from '@/hooks/useSiteLeads';
import { useOnAppResume } from '@/hooks/useAppResume';
import { NAV_ITEMS, NavItem } from './navItems';
import { useNavPrefsStore } from '@/store/navPrefsStore';
import { bottomNavPaths } from '@/utils/bottomNav';
import styles from './SideBar.module.scss';
import cn from 'classnames';

dayjs.locale('ru');

export const SideBar: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const { user } = useAuthStore();
  const visibleNavItems = NAV_ITEMS.filter(item => canSeePath(user, item.path));
  const wikiPendingCount = useWikiStore(s => s.pendingCount);
  // Бейдж правок вики на проверке (счётчик ненулевой только у проверяющих)
  // Склад живёт в настройках → справочник: бейдж заканчивающихся товаров на пункте «Настройки»
  const { data: lowStockCount = 0 } = useStockLowCount(isManagerOrAbove(user));
  // Непрочитанные письма — только у создателя
  const { data: mailUnreadCount = 0 } = useMailUnreadCount(canSeeMail(user));
  // Новые заявки с сайта — менеджерам и выше
  const { data: leadsNewCount = 0 } = useSiteLeadsNewCount(canSeeSiteLeads(user));
  const navIcon = (item: NavItem) => {
    if (item.path === '/wiki') return <Badge count={wikiPendingCount} size="small">{item.icon}</Badge>;
    if (item.path === '/mail') return <Badge count={mailUnreadCount} size="small">{item.icon}</Badge>;
    if (item.path === '/leads') return <Badge count={leadsNewCount} size="small">{item.icon}</Badge>;
    if (item.path === '/settings') return <Badge count={lowStockCount} size="small" color="var(--color-warning)">{item.icon}</Badge>;
    return item.icon;
  };
  // Нижняя панель телефона — свой набор из настроек (до пяти), остальное — в «Ещё»
  const chosenBottomNav = useNavPrefsStore(s => (user ? s.bottomNav[user.id] : undefined));
  const bottomPaths = bottomNavPaths(visibleNavItems.map(i => i.path), chosenBottomNav);
  const bottomNavItems = visibleNavItems.filter(item => bottomPaths.includes(item.path));
  const moreItems = visibleNavItems.filter(item => !bottomPaths.includes(item.path));
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs(selectedDate));
  const [datesWithRecords, setDatesWithRecords] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCalendarValue(dayjs(selectedDate));
  }, [selectedDate]);

  // Перешли куда-то (в том числе из меню «Ещё») — меню закрывается
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const moreActive = moreItems.some(item => location.pathname.startsWith(item.path));
  // Бейджи пунктов меню «Ещё» видны и на самой кнопке: заявки и письма важнее склада
  const inMore = (path: string) => moreItems.some(item => item.path === path);
  const moreUrgentCount = (inMore('/leads') ? leadsNewCount : 0) + (inMore('/mail') ? mailUnreadCount : 0);
  const moreWarnCount = inMore('/settings') ? lowStockCount : 0;
  const moreIcon = moreUrgentCount > 0
    ? <Badge count={moreUrgentCount} size="small"><AppstoreOutlined /></Badge>
    : <Badge count={moreWarnCount} size="small" color="var(--color-warning)"><AppstoreOutlined /></Badge>;

  const calendarYear = calendarValue.year();
  const calendarMonth = calendarValue.month() + 1;

  // Инкремент перечитывает точки календаря при возврате в приложение
  const [datesReloadKey, setDatesReloadKey] = useState(0);
  useOnAppResume(() => setDatesReloadKey(k => k + 1));

  useEffect(() => {
    // Быстро листают месяцы — ответ за прошлый месяц не должен затереть текущий
    const controller = new AbortController();
    recordsApi.getDatesWithRecords(calendarYear, calendarMonth, controller.signal)
      .then(dates => setDatesWithRecords(new Set(dates)))
      .catch(() => {
        // Намеренно молча: точки в календаре — украшение, без них расписание работает
      });
    return () => controller.abort();
  }, [calendarYear, calendarMonth, datesReloadKey]);

  const prevMonth = () => setCalendarValue(v => v.subtract(1, 'month'));
  const nextMonth = () => setCalendarValue(v => v.add(1, 'month'));

  const goToToday = () => {
    const today = dayjs();
    setCalendarValue(today);
    setSelectedDate(today.format('YYYY-MM-DD'));
    if (location.pathname !== '/schedule') navigate('/schedule');
  };

  const handleDateSelect = (date: Dayjs, info: { source: string }) => {
    if (info.source !== 'date') return;
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
              onSelect={handleDateSelect}
              cellRender={(current, info) => {
                if (info.type !== 'date') return null;
                const dateStr = (current as Dayjs).format('YYYY-MM-DD');
                return datesWithRecords.has(dateStr)
                  ? <span className={styles.calendarDot} />
                  : null;
              }}
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
              <span className={styles.navIcon}>{navIcon(item)}</span>
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
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(styles.bottomNavItem, { [styles.active]: isActive && !moreOpen })
            }
          >
            <span className={styles.icon}>{navIcon(item)}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        {moreItems.length > 0 && (
          <button
            type="button"
            className={cn(styles.bottomNavItem, styles.moreButton, { [styles.active]: moreActive || moreOpen })}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
          >
            <span className={cn(styles.icon, { [styles.pulse]: moreUrgentCount > 0 && !moreOpen })}>{moreIcon}</span>
            <span>Ещё</span>
          </button>
        )}
      </nav>

      {/* Меню «Ещё»: выезжает снизу из-под нижней навигации */}
      <div
        className={cn(styles.moreOverlay, { [styles.moreOverlayOpen]: moreOpen })}
        onClick={() => setMoreOpen(false)}
        aria-hidden
      />
      <div className={cn(styles.moreSheet, { [styles.moreSheetOpen]: moreOpen })} aria-hidden={!moreOpen}>
        {moreItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            tabIndex={moreOpen ? 0 : -1}
            className={({ isActive }) => cn(styles.moreItem, { [styles.active]: isActive })}
          >
            <span className={styles.moreItemIcon}>{navIcon(item)}</span>
            <span className={styles.moreItemLabel}>{item.label}</span>
            {item.path === '/mail' && mailUnreadCount > 0 && (
              <span className={styles.moreItemHint}>{mailUnreadCount} новых</span>
            )}
            {item.path === '/leads' && leadsNewCount > 0 && (
              <span className={styles.moreItemHint}>{leadsNewCount} новых</span>
            )}
          </NavLink>
        ))}
      </div>
    </>
  );
};
