import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Button, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { recordsApi } from '@/api/records.api';
import { Record } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { recordUnpaid } from '@/utils/records';
import { getErrorMessage, isAbortError } from '@/utils/errors';
import { isEmployee as isEmployeeRole } from '@/utils/roles';
import { LowStockBanner } from '@/components/LowStockBanner';
import { RecordCard } from '@/components/RecordCard';
import { RecordModal } from '@/components/RecordModal';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useOnAppResume } from '@/hooks/useAppResume';
import styles from './SchedulePage.module.scss';

dayjs.locale('ru');

export const SchedulePage: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const { user } = useAuthStore();
  const isEmployee = isEmployeeRole(user);
  const [todayRecords, setTodayRecords] = useState<Record[]>([]);
  const [incompleteRecords, setIncompleteRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Контроллер последнего запроса: при новом (смена даты, обновление) предыдущий отменяется,
  // иначе медленный ответ за старую дату мог перезаписать свежий
  const fetchControllerRef = useRef<AbortController | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  // Даты с записями для точек в мобильном пикере. Грузим только после того,
  // как пикер открыли — на десктопе он скрыт, лишний запрос там не нужен
  // (в сайдбаре свой календарь со своей загрузкой).
  const [pickerOpened, setPickerOpened] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Dayjs>(dayjs(selectedDate));
  const [datesWithRecords, setDatesWithRecords] = useState<Set<string>>(new Set());

  // silent — фоновое обновление: список не прячется на время загрузки, ошибка не затирает данные
  const fetchRecords = useCallback(async ({ silent = false } = {}) => {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    if (!silent) setLoading(true);
    try {
      const [today, incomplete] = await Promise.all([
        recordsApi.getByDate(selectedDate, controller.signal),
        recordsApi.getIncomplete(controller.signal),
      ]);
      setLoadError(null);
      setTodayRecords(today);
      setIncompleteRecords(incomplete);
      // Обновляем открытую карточку, если она есть
      setSelectedRecord(prev => {
        if (!prev) return null;
        return [...today, ...incomplete].find(r => r.id === prev.id) || prev;
      });
    } catch (e) {
      if (isAbortError(e) || silent) return;
      setLoadError(getErrorMessage(e));
    } finally {
      // Отменённый запрос уже заменён новым — его индикатор загрузки не трогаем
      if (fetchControllerRef.current === controller) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Отменяем незавершённый запрос при уходе со страницы
  useEffect(() => () => fetchControllerRef.current?.abort(), []);

  const datesControllerRef = useRef<AbortController | null>(null);
  const fetchDatesWithRecords = useCallback(() => {
    datesControllerRef.current?.abort();
    const controller = new AbortController();
    datesControllerRef.current = controller;
    recordsApi.getDatesWithRecords(pickerMonth.year(), pickerMonth.month() + 1, controller.signal)
      .then(dates => setDatesWithRecords(new Set(dates)))
      .catch(() => {
        // Намеренно молча: точки в пикере — украшение, на работу расписания не влияют
      });
  }, [pickerMonth]);

  useEffect(() => {
    if (!pickerOpened) return;
    fetchDatesWithRecords();
    return () => datesControllerRef.current?.abort();
  }, [pickerOpened, fetchDatesWithRecords]);

  // Вернулись в приложение — тихо перечитываем расписание
  useOnAppResume(() => {
    fetchRecords({ silent: true });
    if (pickerOpened) fetchDatesWithRecords();
  });

  // Меняем стейт только при смене месяца, иначе новый объект Dayjs
  // каждый раз дёргал бы загрузку заново.
  const syncPickerMonth = (value: Dayjs) => {
    setPickerMonth(prev => (prev.isSame(value, 'month') ? prev : value));
  };

  const displayDate = dayjs(selectedDate);
  const dateLabel = displayDate.format('D MMMM YYYY');

  // Остаток к оплате считается так же, как в карточке записи (utils/records.ts)
  // В столбце дня лежат записи всех статусов, поэтому считаем только те,
  // по которым сделка ещё не закрыта и не отменена.
  const todayOpenSum = todayRecords
    .filter(r => r.status === 'ACTIVE')
    .reduce((s, r) => s + recordUnpaid(r), 0);

  // Незавершённые — все ACTIVE с прошлых дат, суммируем целиком
  const incompleteSum = incompleteRecords.reduce((s, r) => s + recordUnpaid(r), 0);

  return (
    <div className={styles.page}>
      <LowStockBanner />
      <div className={styles.recordsHeader}>
        <div className={styles.recordsTitle}>
          Расписание
        </div>
        <div className={styles.headerActions}>
          {/* Mobile date picker */}
          <DatePicker
            value={displayDate}
            onChange={(d: Dayjs | null) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
            format="DD MMMM YYYY"
            allowClear={false}
            inputReadOnly
            className={styles.mobilePicker}
            onOpenChange={open => {
              if (!open) return;
              setPickerOpened(true);
              syncPickerMonth(displayDate);
            }}
            onPanelChange={value => syncPickerMonth(value)}
            cellRender={(current, info) => {
              if (info.type !== 'date') return info.originNode;
              const date = current as Dayjs;
              if (!datesWithRecords.has(date.format('YYYY-MM-DD'))) return info.originNode;
              return (
                <div className={styles.pickerCell}>
                  {info.originNode}
                  <span className={styles.pickerDot} />
                </div>
              );
            }}
          />
          {!isEmployee && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Новая запись
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <Alert
          className={styles.loadError}
          type="error"
          showIcon
          message="Не удалось загрузить записи"
          description={loadError}
          action={<Button size="small" onClick={() => fetchRecords()}>Повторить</Button>}
        />
      )}

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            {dateLabel}
            <span className={styles.columnMeta}>
              {!isEmployee && todayOpenSum > 0 && (
                <span className={styles.columnSum} title="Остаток к оплате по незакрытым сделкам (без учтённой предоплаты)">
                  {formatPrice(todayOpenSum)}
                </span>
              )}
              <span className={styles.columnCount}>{todayRecords.length}</span>
            </span>
          </div>
          <div className={styles.columnBody}>
            {loading || loadError ? null : todayRecords.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📅</div>
                <p>Записей на этот день нет</p>
                {!isEmployee && (
                  <Button type="link" onClick={() => setCreateModalOpen(true)}>
                    Создать запись
                  </Button>
                )}
              </div>
            ) : (
              todayRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onClick={() => setSelectedRecord(record)}
                />
              ))
            )}
          </div>
        </div>

        <div className={styles.column}>
          <div className={`${styles.columnHeader} ${styles.columnOverdue}`}>
            Незавершённые
            <span className={styles.columnMeta}>
              {!isEmployee && incompleteSum > 0 && (
                <span className={styles.columnSum} title="Остаток к оплате по записям столбца (без учтённой предоплаты)">
                  {formatPrice(incompleteSum)}
                </span>
              )}
              <span className={styles.columnCount}>{incompleteRecords.length}</span>
            </span>
          </div>
          <div className={styles.columnBody}>
            {loadError ? null : incompleteRecords.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✅</div>
                <p>Незавершённых записей нет</p>
              </div>
            ) : (
              incompleteRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onClick={() => setSelectedRecord(record)}
                />
              ))
            )}
          </div>
        </div>

      </div>

      <RecordModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          fetchRecords();
          setTimeout(() => fetchRecords(), 3000);
          if (pickerOpened) fetchDatesWithRecords();
        }}
        initialDate={selectedDate}
      />

      <RecordDetailModal
        record={selectedRecord}
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onRefresh={() => fetchRecords()}
      />
    </div>
  );
};
