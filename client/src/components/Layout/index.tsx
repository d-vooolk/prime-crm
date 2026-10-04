import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SideBar } from '@/components/SideBar';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/PageLoader';
import { useNotesNotifications } from '@/hooks/useNotesNotifications';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useWikiPendingCount } from '@/hooks/useWikiPendingCount';
import styles from './Layout.module.scss';

/**
 * Страховка для iOS: если документ всё-таки оказался прокручен (клавиатура, программный скролл),
 * возвращаем его в ноль — при смене раздела и когда поле теряет фокус (клавиатура закрылась).
 * Иначе нажатия на фиксированные элементы (модалки, нижнее меню) срабатывают со смещением.
 */
function useResetDocumentScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocusOut = () => {
      clearTimeout(timer);
      // Ждём, пока клавиатура уедет, и не мешаем, если фокус сразу ушёл в соседнее поле
      timer = setTimeout(() => {
        const el = document.activeElement;
        const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
        if (!typing && (window.scrollY || window.scrollX)) window.scrollTo(0, 0);
      }, 300);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
}

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  useNotesNotifications();
  useWikiPendingCount();
  useResetDocumentScroll();

  return (
    <div className={styles.root}>
      <SideBar />
      <main className={styles.main}>
        <OfflineBanner />
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
