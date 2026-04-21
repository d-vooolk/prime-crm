import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Layout } from '@/components/Layout';
import { PrivateRoute } from '@/components/PrivateRoute';
import { SchedulePage } from '@/pages/SchedulePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { lightTheme, darkTheme } from '@/config/antdTheme';

dayjs.locale('ru');

const App: React.FC = () => {
  const { theme } = useUiStore();
  const { user } = useAuthStore();
  const scheduleOnly = user?.role === 'Сотрудник';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider locale={ruRU} theme={theme === 'dark' ? darkTheme : lightTheme}>
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
              <Route path="clients" element={scheduleOnly ? <Navigate to="/schedule" replace /> : <ClientsPage />} />
              <Route path="services" element={scheduleOnly ? <Navigate to="/schedule" replace /> : <ServicesPage />} />
              <Route path="settings" element={scheduleOnly ? <Navigate to="/schedule" replace /> : <SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
