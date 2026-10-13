import React from 'react';
import {
  CalendarOutlined,
  DashboardOutlined,
  BookOutlined,
  SettingOutlined,
  AccountBookOutlined,
  FileTextOutlined,
  MailOutlined,
  VideoCameraOutlined,
  InboxOutlined,
} from '@ant-design/icons';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Разделы меню в порядке показа. На компьютере — все доступные в боковом меню, на телефоне —
 * до пяти в нижней панели (свой набор в настройках, utils/bottomNav.ts), остальные — в «Ещё»
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/schedule', label: 'Расписание', icon: <CalendarOutlined /> },
  { path: '/leads', label: 'Заявки', icon: <InboxOutlined /> },
  { path: '/dashboard', label: 'Дашборд', icon: <DashboardOutlined /> },
  { path: '/wiki', label: 'Wiki', icon: <BookOutlined /> },
  { path: '/accounting', label: 'Бухгалтерия', icon: <AccountBookOutlined /> },
  { path: '/notes', label: 'Заметки', icon: <FileTextOutlined /> },
  { path: '/mail', label: 'Почта', icon: <MailOutlined /> },
  { path: '/camera', label: 'Камера', icon: <VideoCameraOutlined /> },
  { path: '/settings', label: 'Настройки', icon: <SettingOutlined /> },
];
