import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { queryClient } from '@/lib/queryClient';
import { useUiStore } from '@/store/uiStore';
import { isLongEnoughHidden, followToday } from '@/utils/appResume';
import { checkForUpdate } from '@/pwa';

/**
 * Возврат в приложение: телефон разблокировали, CRM развернули из фона (пробыла скрытой
 * дольше RESUME_MIN_HIDDEN_MS) или вернулась сеть. Установленное приложение неделями не
 * перезагружается, поэтому страницы в этот момент перечитывают свои данные.
 * Слушатели документа ставятся один раз на всё приложение.
 */
const listeners = new Set<() => void>();
let hiddenAt: number | null = null;
let started = false;

function emit() {
  listeners.forEach(listener => listener());
}

function start() {
  if (started) return;
  started = true;
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const resumed = isLongEnoughHidden(hiddenAt, Date.now());
    hiddenAt = null;
    if (resumed) emit();
  });
  window.addEventListener('online', emit);
}

/** Вызвать callback при возврате в приложение. Сам callback может меняться между рендерами */
export function useOnAppResume(callback: () => void) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    start();
    const listener = () => callbackRef.current();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
}

/**
 * Общее для всего приложения (подключается в Layout): данные react-query перечитываются
 * (активные запросы — сразу, остальные — при следующем показе), а расписание,
 * открытое на «сегодня», после смены суток переходит на новый сегодняшний день.
 * Заодно проверяется новая версия приложения — не дожидаясь часовой проверки.
 */
export function useAppResumeRefresh() {
  const todayRef = useRef(dayjs().format('YYYY-MM-DD'));

  useOnAppResume(() => {
    void queryClient.invalidateQueries();
    checkForUpdate();

    const today = dayjs().format('YYYY-MM-DD');
    const { selectedDate, setSelectedDate } = useUiStore.getState();
    const next = followToday(selectedDate, todayRef.current, today);
    if (next !== selectedDate) setSelectedDate(next);
    todayRef.current = today;
  });
}
