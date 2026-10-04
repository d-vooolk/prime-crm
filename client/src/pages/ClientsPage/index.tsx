import React, { useEffect, useState } from 'react';
import { Alert, Button, Grid } from 'antd';
import { clientsApi } from '@/api/clients.api';
import { recordsApi } from '@/api/records.api';
import type { Client, Record } from '@/types';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { ClientHistoryDrawer } from '@/components/ClientHistoryDrawer';
import { useNotify } from '@/hooks/useNotify';
import { useOnAppResume } from '@/hooks/useAppResume';
import { getErrorMessage, isAbortError } from '@/utils/errors';
import { useClientsFilter } from './useClientsFilter';
import { ClientsFilters } from './ClientsFilters';
import { ClientsList } from './ClientsList';
import styles from './ClientsPage.module.scss';

export const ClientsPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const notify = useNotify();
  const f = useClientsFilter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Инкремент перезапускает загрузку списка (кнопка «Повторить»)
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  // Инкремент заставляет панель перечитать клиента после правки записи
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const { filter } = f;

  // Вернулись в приложение — перечитываем список и открытую историю клиента
  useOnAppResume(() => {
    setReloadKey(k => k + 1);
    setHistoryRefresh(k => k + 1);
  });

  // Список клиентов: предыдущий запрос отменяем, чтобы поздний ответ не перетёр свежий
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    clientsApi.getAll(filter, controller.signal)
      .then(data => { setClients(data); setLoadError(null); })
      .catch(e => {
        if (isAbortError(e)) return;
        setClients([]);
        setLoadError(getErrorMessage(e));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, reloadKey]);

  const handleRecordClick = async (recordId: string) => {
    try {
      const record = await recordsApi.getById(recordId);
      setSelectedRecord(record);
      setRecordModalOpen(true);
    } catch (e) {
      notify.error(e, 'Не удалось открыть запись');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        {!loading && !loadError && f.hasFilters && (
          <span className={styles.found}>Найдено: {clients.length}</span>
        )}
      </div>

      <ClientsFilters f={f} isMobile={isMobile} onSelectClient={setSelectedClientId} />

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить клиентов"
          description={loadError}
          action={<Button size="small" onClick={() => setReloadKey(k => k + 1)}>Повторить</Button>}
        />
      ) : (
        <ClientsList
          clients={clients}
          loading={loading}
          isMobile={isMobile}
          recordFilterActive={f.recordFilterActive}
          serviceSelected={!!f.serviceId}
          onSelectClient={setSelectedClientId}
          onSelectRecord={handleRecordClick}
        />
      )}

      <ClientHistoryDrawer
        clientId={selectedClientId}
        open={!!selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onSelectRecord={handleRecordClick}
        refreshKey={historyRefresh}
      />

      <RecordDetailModal
        record={selectedRecord}
        open={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); setSelectedRecord(null); }}
        onRefresh={() => setHistoryRefresh(n => n + 1)}
      />
    </div>
  );
};
