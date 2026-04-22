import React, { useState, useEffect, useCallback } from 'react';
import { Button, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { recordsApi } from '@/api/records.api';
import { Record } from '@/types';
import { RecordCard } from '@/components/RecordCard';
import { RecordModal } from '@/components/RecordModal';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import styles from './SchedulePage.module.scss';

dayjs.locale('ru');

export const SchedulePage: React.FC = () => {
  const { selectedDate, setSelectedDate } = useUiStore();
  const { user } = useAuthStore();
  const isEmployee = user?.role === 'Сотрудник';
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
      // Обновляем открытую карточку, если она есть
      setSelectedRecord(prev => {
        if (!prev) return null;
        return [...today, ...incomplete].find(r => r.id === prev.id) || prev;
      });
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const displayDate = dayjs(selectedDate);
  const dateLabel = displayDate.format('D MMMM YYYY');

  return (
    <div className={styles.page}>
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

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            {dateLabel}
            <span className={styles.columnCount}>{todayRecords.length}</span>
          </div>
          <div className={styles.columnBody}>
            {loading ? null : todayRecords.length === 0 ? (
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

      <RecordModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => { fetchRecords(); setTimeout(fetchRecords, 3000); }}
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
