import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Grid } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Layout } from '@/components/Layout';
import { PrivateRoute } from '@/components/PrivateRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/PageLoader';
import { QueryErrorReporter } from '@/components/QueryErrorReporter';
import { LoginPage } from '@/pages/LoginPage';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useAuthSync } from '@/hooks/useAuthSync';
import { PwaUpdateNotice } from '@/components/PwaUpdateNotice';
import { queryClient } from '@/lib/queryClient';
import { isEmployee } from '@/utils/roles';
import { lightTheme, darkTheme } from '@/config/antdTheme';

dayjs.locale('ru');

// Страницы грузятся отдельными чанками: recharts и прочие тяжёлые зависимости не попадают в стартовый бандл
const SchedulePage = lazy(() => import('@/pages/SchedulePage').then(m => ({ default: m.SchedulePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WikiPage = lazy(() => import('@/pages/WikiPage').then(m => ({ default: m.WikiPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AccountingPage = lazy(() => import('@/pages/AccountingPage').then(m => ({ default: m.AccountingPage })));
const NotesPage = lazy(() => import('@/pages/NotesPage').then(m => ({ default: m.NotesPage })));

const App: React.FC = () => {
  const { theme } = useUiStore();
  // На телефоне виртуальная прокрутка выпадающих списков (JS-эмуляция по touch-событиям)
  // упускает часть жестов, и вместо списка листается модалка под ним. Без неё список —
  // обычный нативный скролл, который не отдаёт прокрутку наружу (см. global.scss).
  const isMobile = !Grid.useBreakpoint().md;
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const scheduleOnly = isEmployee(user);

  useAuthSync();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // После выхода кеш справочников предыдущего пользователя не должен достаться следующему
  useEffect(() => {
    if (!token) queryClient.clear();
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={ruRU} theme={theme === 'dark' ? darkTheme : lightTheme} virtual={!isMobile}>
        <AntApp>
          <QueryErrorReporter />
          <PwaUpdateNotice />
          <ErrorBoundary>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
                    <Route path="accounting" element={<AccountingPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
