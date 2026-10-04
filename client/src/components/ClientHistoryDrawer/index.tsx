import React, { useState, useEffect } from 'react';
import { Alert, Button, Drawer, Descriptions, Divider, Empty, Tag, Collapse, Spin, Table } from 'antd';
import { clientsApi } from '@/api/clients.api';
import { ClientWithRecords, Record as CrmRecord, RecordItem } from '@/types';
import { formatDate, formatTime, formatPrice } from '@/utils/formatters';
import { getErrorMessage } from '@/utils/errors';
import styles from './ClientHistoryDrawer.module.scss';

interface Props {
  clientId: string | null;
  open: boolean;
  onClose: () => void;
  /** Запись, из которой открыли историю — помечается как текущая */
  currentRecordId?: string;
  /**
   * Если задан, клик по визиту отдаётся наружу (страница клиентов так
   * открывает карточку записи). Если не задан, подробности разворачиваются
   * прямо в панели — чтобы не открывать модалку поверх модалки.
   */
  onSelectRecord?: (recordId: string) => void;
  /** Изменение значения заставляет перечитать клиента (после правки записи) */
  refreshKey?: number;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'blue', label: 'Активна' },
  CLOSED: { color: 'green', label: 'Завершена' },
  CANCELLED: { color: 'red', label: 'Отменена' },
};

const itemsTotal = (items: RecordItem[]) =>
  items.reduce((s, i) => s + i.price * i.quantity, 0);

const itemsPrepaid = (items: RecordItem[]) =>
  items.reduce((s, i) => s + (i.prepaidAmount || 0), 0);

const recordTotal = (r: CrmRecord) =>
  r.deal ? r.deal.finalPrice : itemsTotal(r.items);

/** Кто делал услугу: делёж между мастерами, отдельный исполнитель или основной мастер записи */
const itemPerformers = (item: RecordItem, record: CrmRecord): string[] => {
  if (item.service?.isProduct) return [];
  if (item.servicemanSplit?.length) return item.servicemanSplit.map(e => e.name);
  const name = item.servicemanName || record.serviceman;
  return name ? [name] : [];
};

/** Доп. мастера записи (кроме основного) и услуги, которые делал каждый */
const extraPerformers = (record: CrmRecord): Array<{ name: string; services: string[] }> => {
  const map = new Map<string, string[]>();
  for (const item of record.items) {
    for (const name of itemPerformers(item, record)) {
      if (name === record.serviceman) continue;
      const services = map.get(name) ?? [];
      const serviceName = item.service?.name || '—';
      if (!services.includes(serviceName)) services.push(serviceName);
      map.set(name, services);
    }
  }
  return [...map].map(([name, services]) => ({ name, services }));
};

/** Основной мастер и доп. мастера с их услугами — видно сразу, без раскрытия визита */
const VisitPerformers: React.FC<{ record: CrmRecord }> = ({ record }) => {
  const extras = extraPerformers(record);
  if (!record.serviceman && extras.length === 0) return null;
  return (
    <div className={styles.performers}>
      {record.serviceman && (
        <div>
          <span className={styles.performerLabel}>Мастер:</span> {record.serviceman}
        </div>
      )}
      {extras.map(e => (
        <div key={e.name}>
          <span className={styles.performerLabel}>Доп. мастер:</span> {e.name} — {e.services.join(', ')}
        </div>
      ))}
    </div>
  );
};

/** О чём клиента предупредили в акте — видно сразу, без раскрытия визита */
const DealWarnings: React.FC<{ record: CrmRecord }> = ({ record }) => {
  const { defects, recommendations } = record.deal ?? {};
  if (!defects && !recommendations) return null;
  return (
    <div className={styles.warnings}>
      {defects && (
        <div>
          <span className={styles.warningLabel}>Обнаруженные недостатки:</span> {defects}
        </div>
      )}
      {recommendations && (
        <div>
          <span className={styles.warningLabel}>Рекомендации:</span> {recommendations}
        </div>
      )}
    </div>
  );
};

/** Шапка визита — одинаковая и для кликабельного, и для разворачиваемого режима */
const VisitSummary: React.FC<{ record: CrmRecord; isCurrent: boolean }> = ({ record, isCurrent }) => {
  const status = STATUS_MAP[record.status];
  return (
    <div className={styles.visitRow}>
      <div className={styles.visitMain}>
        <div className={styles.visitDate}>
          {formatDate(record.scheduledAt)}
          <span className={styles.visitTime}>{formatTime(record.scheduledAt)}</span>
          {isCurrent && <Tag className={styles.currentTag}>текущая</Tag>}
        </div>
        <div className={styles.visitMeta}>
          {record.car.brand} {record.car.model}
          {record.car.plateNumber ? ` · ${record.car.plateNumber}` : ''}
          {' · '}{record.items.length} услуг
        </div>
        <VisitPerformers record={record} />
        <DealWarnings record={record} />
      </div>
      <div className={styles.visitSide}>
        <div className={styles.visitSum}>{formatPrice(recordTotal(record))}</div>
        <Tag color={status.color} className={styles.statusTag}>{status.label}</Tag>
      </div>
    </div>
  );
};

/** Подробности визита — услуги, суммы, мастер, гарантия */
const VisitDetails: React.FC<{ record: CrmRecord }> = ({ record }) => {
  const total = itemsTotal(record.items);
  const prepaid = itemsPrepaid(record.items);

  return (
    <div className={styles.details}>
      <Descriptions size="small" column={1} className={styles.detailsInfo}>
        <Descriptions.Item label="Автомобиль">
          {record.car.brand} {record.car.model} {record.car.year}
          {record.car.plateNumber ? ` · ${record.car.plateNumber}` : ''}
        </Descriptions.Item>
        {record.notes && (
          <Descriptions.Item label="Примечание">{record.notes}</Descriptions.Item>
        )}
      </Descriptions>

      <Table<RecordItem>
        dataSource={record.items}
        rowKey="id"
        size="small"
        pagination={false}
        className={styles.itemsTable}
        columns={[
          { title: 'Услуга', key: 'name', render: (_, i) => i.service?.name || '—' },
          {
            title: 'Мастер', key: 'performer', render: (_, i) =>
              itemPerformers(i, record).join(', ') || '—',
          },
          { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 70 },
          { title: 'Цена', key: 'price', width: 90, render: (_, i) => formatPrice(i.price) },
          { title: 'Сумма', key: 'sum', width: 90, render: (_, i) => formatPrice(i.price * i.quantity) },
        ]}
      />

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Итого по услугам</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        {prepaid > 0 && (
          <>
            <div className={styles.totalRow}>
              <span>Предоплата</span>
              <strong>−{formatPrice(prepaid)}</strong>
            </div>
            {!record.deal && (
              <div className={styles.totalRow}>
                <span>Остаток к оплате</span>
                <strong>{formatPrice(Math.max(0, total - prepaid))}</strong>
              </div>
            )}
          </>
        )}
        {record.deal && (
          <>
            <div className={styles.totalRow}>
              <span>Итог сделки</span>
              <strong>{formatPrice(record.deal.finalPrice)}</strong>
            </div>
            {record.deal.warranty && (
              <div className={styles.totalRow}>
                <span>Гарантия</span>
                <strong>{record.deal.warranty}</strong>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const ClientHistoryDrawer: React.FC<Props> = ({
  clientId, open, onClose, currentRecordId, onSelectRecord, refreshKey,
}) => {
  const [client, setClient] = useState<ClientWithRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Инкремент — повторная загрузка по кнопке «Повторить»
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setLoading(true);
    clientsApi.getById(clientId)
      .then(data => { if (!cancelled) { setClient(data); setLoadError(null); } })
      .catch(e => { if (!cancelled) { setClient(null); setLoadError(getErrorMessage(e)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId, refreshKey, retryKey]);

  const records = client?.records || [];
  const closedCount = records.filter(r => r.status === 'CLOSED').length;
  const spent = records
    .filter(r => r.status === 'CLOSED')
    .reduce((s, r) => s + recordTotal(r), 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      title={client?.name || 'История клиента'}
      className={styles.drawer}
    >
      {loading && !client ? (
        <div className={styles.loader}><Spin /></div>
      ) : !client ? (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить клиента"
          description={loadError}
          action={<Button size="small" onClick={() => setRetryKey(k => k + 1)}>Повторить</Button>}
        />
      ) : (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Телефон">{client.phone}</Descriptions.Item>
            {client.notes && (
              <Descriptions.Item label="Примечание">{client.notes}</Descriptions.Item>
            )}
          </Descriptions>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{records.length}</div>
              <div className={styles.statLabel}>всего визитов</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{closedCount}</div>
              <div className={styles.statLabel}>завершено</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{formatPrice(spent)}</div>
              <div className={styles.statLabel}>на сумму</div>
            </div>
          </div>

          {client.cars.length > 0 && (
            <>
              <Divider orientation="left" className={styles.divider}>Автомобили</Divider>
              <div className={styles.cars}>
                {client.cars.map(car => (
                  <Tag key={car.id}>
                    {car.brand} {car.model} {car.year}
                    {car.plateNumber ? ` · ${car.plateNumber}` : ''}
                  </Tag>
                ))}
              </div>
            </>
          )}

          <Divider orientation="left" className={styles.divider}>История визитов</Divider>
          {records.length === 0 ? (
            <Empty description="Нет записей" />
          ) : onSelectRecord ? (
            records.map(r => (
              <div
                key={r.id}
                className={styles.visitClickable}
                onClick={() => onSelectRecord(r.id)}
              >
                <VisitSummary record={r} isCurrent={r.id === currentRecordId} />
              </div>
            ))
          ) : (
            <Collapse
              accordion
              className={styles.collapse}
              defaultActiveKey={currentRecordId}
              items={records.map(r => ({
                key: r.id,
                label: <VisitSummary record={r} isCurrent={r.id === currentRecordId} />,
                children: <VisitDetails record={r} />,
              }))}
            />
          )}
        </>
      )}
    </Drawer>
  );
};
