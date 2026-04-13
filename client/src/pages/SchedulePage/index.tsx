import React, { useState, useEffect, useCallback } from 'react';
import { Button, Calendar, DatePicker, Badge } from 'antd';
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { recordsApi } from '@/api/records.api';
import { Record } from '@/types';
import { RecordCard } from '@/components/RecordCard';
import { RecordModal } from '@/components/RecordModal';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { useUiStore } from '@/store/uiStore';
import styles from './SchedulePage.module.scss';

dayjs.locale('ru');

export const SchedulePage: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const [todayRecords, setTodayRecords] = useState<Record[]>([]);
  const [incompleteRecords, setIncompleteRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [today, incomplete] = await Promise.all([
        recordsApi.getByDate(selectedDate),
        recordsApi.getIncomplete(),
      ]);
      setTodayRecords(today);
      setIncompleteRecords(incomplete);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDateChange = (d: Dayjs) => {
    setSelectedDate(d.format('YYYY-MM-DD'));
  };

  const displayDate = dayjs(selectedDate);
  const isToday = displayDate.isSame(dayjs(), 'day');
  const dateLabel = isToday
    ? 'Сегодня'
    : displayDate.format('D MMMM YYYY');

  return (
    <div className={styles.page}>
      {/* ─── Calendar panel (desktop) ─── */}
      <div className={styles.calendarPanel}>
        <div className={styles.calendarHeader}>Календарь</div>
        <Calendar
          fullscreen={false}
          value={displayDate}
          onChange={handleDateChange}
          style={{ padding: '0 8px' }}
          cellRender={(date) => {
            const key = date.format('YYYY-MM-DD');
            const hasRecords = todayRecords.some(r =>
              dayjs(r.scheduledAt).format('YYYY-MM-DD') === key
            );
            return hasRecords ? <Badge status="processing" /> : null;
          }}
        />
      </div>

      {/* ─── Records area ─── */}
      <div className={styles.recordsArea}>
        <div className={styles.recordsHeader}>
          <div className={styles.recordsTitle}>
            Расписание
            <span>{dateLabel}</span>
          </div>
          <div className={styles.headerActions}>
            {/* Mobile date picker */}
            <DatePicker
              value={displayDate}
              onChange={d => d && handleDateChange(d)}
              format="DD.MM.YYYY"
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
              style={{ display: 'none' }}
              className="mobile-date-picker"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              size="large"
            >
              Новая запись
            </Button>
          </div>
        </div>

        {/* Mobile date row */}
        <div className={styles.mobileDateRow}>
          <DatePicker
            value={displayDate}
            onChange={d => d && handleDateChange(d)}
            format="DD MMMM YYYY"
            allowClear={false}
            style={{ flex: 1 }}
          />
        </div>

        <div className={styles.columns}>
          {/* ─── Today column ─── */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              {dateLabel}
              <span className={styles.columnCount}>{todayRecords.length}</span>
            </div>
            <div className={styles.columnBody}>
              {todayRecords.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📅</div>
                  <p>Записей на этот день нет</p>
                  <Button
                    type="link"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    Создать запись
                  </Button>
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

          {/* ─── Incomplete column ─── */}
          <div className={styles.column}>
            <div className={`${styles.columnHeader} ${styles.columnOverdue}`}>
              Незавершённые
              <span className={styles.columnCount}>{incompleteRecords.length}</span>
            </div>
            <div className={styles.columnBody}>
              {incompleteRecords.length === 0 ? (
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
      </div>

      {/* ─── Modals ─── */}
      <RecordModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchRecords}
        initialDate={selectedDate}
      />

      <RecordDetailModal
        record={selectedRecord}
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onRefresh={fetchRecords}
      />
    </div>
  );
};
