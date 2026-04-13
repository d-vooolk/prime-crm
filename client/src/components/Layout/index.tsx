import React from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar } from '@/components/SideBar';
import styles from './Layout.module.scss';

export const Layout: React.FC = () => {
  return (
    <div className={styles.root}>
      <SideBar />
      <main className={styles.main}>
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
