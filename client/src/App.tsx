import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Layout } from '@/components/Layout';
import { SchedulePage } from '@/pages/SchedulePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useUiStore } from '@/store/uiStore';
import { lightTheme, darkTheme } from '@/config/antdTheme';

dayjs.locale('ru');

const App: React.FC = () => {
  const { theme } = useUiStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider locale={ruRU} theme={theme === 'dark' ? darkTheme : lightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/schedule" replace />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
