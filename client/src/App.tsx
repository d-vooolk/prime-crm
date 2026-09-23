import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Grid } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Layout } from '@/components/Layout';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SchedulePage } from '@/pages/SchedulePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WikiPage } from '@/pages/WikiPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AccountingPage } from '@/pages/AccountingPage';
import { NotesPage } from '@/pages/NotesPage';
import { LoginPage } from '@/pages/LoginPage';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { lightTheme, darkTheme } from '@/config/antdTheme';

dayjs.locale('ru');

const App: React.FC = () => {
  const { theme } = useUiStore();
  // На телефоне виртуальная прокрутка выпадающих списков (JS-эмуляция по touch-событиям)
  // упускает часть жестов, и вместо списка листается модалка под ним. Без неё список —
  // обычный нативный скролл, который не отдаёт прокрутку наружу (см. global.scss).
  const isMobile = !Grid.useBreakpoint().md;
  const { user } = useAuthStore();
  const scheduleOnly = user?.role === 'Сотрудник';
  const canSeeAccounting = !!user;
  const canSeeNotes = !!user;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider locale={ruRU} theme={theme === 'dark' ? darkTheme : lightTheme} virtual={!isMobile}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/schedule" replace />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="dashboard" element={scheduleOnly ? <Navigate to="/schedule" replace /> : <DashboardPage />} />
              {/* Справочник переехал во вкладку настроек */}
              <Route path="clients" element={<Navigate to="/settings?tab=directory" replace />} />
              <Route path="services" element={<Navigate to="/settings?tab=directory" replace />} />
              <Route path="wiki" element={<WikiPage />} />
              <Route path="accounting" element={canSeeAccounting ? <AccountingPage /> : <Navigate to="/schedule" replace />} />
              <Route path="notes" element={canSeeNotes ? <NotesPage /> : <Navigate to="/schedule" replace />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
