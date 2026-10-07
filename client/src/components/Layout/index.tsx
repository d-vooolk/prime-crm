import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SideBar } from '@/components/SideBar';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/PageLoader';
import { useNotesNotifications } from '@/hooks/useNotesNotifications';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useWikiPendingCount } from '@/hooks/useWikiPendingCount';
import { useAppResumeRefresh } from '@/hooks/useAppResume';
import { PushPrompt } from '@/components/PushPrompt';
import { autoEnablePush } from '@/pwa';
import { useAuthStore } from '@/store/authStore';
import { resetViewportShift, watchViewportShift } from '@/utils/iosViewport';
import styles from './Layout.module.scss';

/**
 * Страховка для iOS: после клавиатуры экран может остаться сдвинутым (см. utils/iosViewport) —
 * тогда модалки уезжают под статус-бар, а нажатия срабатывают со смещением. Возвращаем его
 * на место при смене раздела и когда клавиатура закрылась.
 */
function useResetDocumentScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    resetViewportShift();
  }, [pathname]);

  useEffect(() => watchViewportShift(), []);
}

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  useNotesNotifications();
  useWikiPendingCount();
  useResetDocumentScroll();
  useAppResumeRefresh();

  // Разрешение на уведомления уже есть — подписываем устройство на пуши вошедшего пользователя
  const userId = useAuthStore(s => s.user?.id);
  useEffect(() => {
    if (userId) void autoEnablePush();
  }, [userId]);

  return (
    <div className={styles.root}>
      <SideBar />
      <main className={styles.main}>
        <OfflineBanner />
        <PushPrompt />
        <BirthdayBanner />
        <div className={styles.pageContent} data-page-scroll>
          {/* Своя граница ошибок и Suspense у контента: меню остаётся на месте, а при переходе в другой раздел ошибка сбрасывается */}
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
