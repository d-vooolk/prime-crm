import React from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar } from '@/components/SideBar';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { useNotesNotifications } from '@/hooks/useNotesNotifications';
import styles from './Layout.module.scss';

export const Layout: React.FC = () => {
  useNotesNotifications();

  return (
    <div className={styles.root}>
      <SideBar />
      <main className={styles.main}>
        <BirthdayBanner />
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
