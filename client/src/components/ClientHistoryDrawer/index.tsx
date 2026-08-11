import React, { useState, useEffect } from 'react';
import { Drawer, Descriptions, Divider, Empty, Tag, Collapse, Spin, Table } from 'antd';
import { clientsApi } from '@/api/clients.api';
import { ClientWithRecords, Record as CrmRecord, RecordItem } from '@/types';
import { formatDate, formatTime, formatPrice } from '@/utils/formatters';
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
        {record.serviceman && (
          <Descriptions.Item label="Мастер">{record.serviceman}</Descriptions.Item>
        )}
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

  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    setLoading(true);
    clientsApi.getById(clientId)
      .then(data => { if (!cancelled) setClient(data); })
      .catch(() => { if (!cancelled) setClient(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId, refreshKey]);

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
        <Empty description="Не удалось загрузить клиента" />
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
