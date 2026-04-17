import React, { useState, useEffect } from 'react';
import { Input, Table, Tag, Drawer, Descriptions, Divider, Empty } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { clientsApi } from '@/api/clients.api';
import { recordsApi } from '@/api/records.api';
import { Client, Record } from '@/types';
import { formatDate, formatPrice } from '@/utils/formatters';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import styles from './ClientsPage.module.scss';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    clientsApi.getAll(search).then(setClients).finally(() => setLoading(false));
  }, [search]);

  const handleRecordClick = async (recordId: string) => {
    try {
      const record = await recordsApi.getById(recordId);
      setSelectedRecord(record);
      setRecordModalOpen(true);
    } catch {
      /* silent */
    }
  };

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>
          <UserOutlined style={{ marginRight: 6, color: 'var(--color-text-muted)' }} />
          {name}
        </span>
      ),
    },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Автомобили',
      key: 'cars',
      render: (_: unknown, row: Client) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {row.cars.map(car => (
            <Tag key={car.id}>{car.brand} {car.model} {car.year}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Записей',
      key: 'visits',
      width: 100,
      render: (_: unknown, row: Client) => row._count?.records || 0,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Поиск по имени или телефону"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
      </div>

      <Table
        dataSource={clients}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(row) => ({
          style: { cursor: 'pointer' },
          onClick: () => clientsApi.getById(row.id).then(setSelected),
        })}
      />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={560}
        title={selected?.name || 'Клиент'}
      >
        {selected && (
          <>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Телефон">{selected.phone}</Descriptions.Item>
              {selected.notes && (
                <Descriptions.Item label="Примечание">{selected.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 13 }}>Автомобили</Divider>
            {selected.cars.map(car => (
              <Tag key={car.id} style={{ marginBottom: 6 }}>
                {car.brand} {car.model} {car.year}{car.plateNumber ? ` · ${car.plateNumber}` : ''}
              </Tag>
            ))}

            <Divider orientation="left" style={{ fontSize: 13 }}>История визитов</Divider>
            {(selected as Client & { records?: Record[] }).records?.length === 0 ? (
              <Empty description="Нет записей" />
            ) : (
              (selected as Client & { records?: Record[] }).records?.map(r => (
                <div
                  key={r.id}
                  onClick={() => handleRecordClick(r.id)}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--color-surface-2)',
                    borderRadius: 8,
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{formatDate(r.scheduledAt)}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {r.car.brand} {r.car.model} · {r.items.length} услуг
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>
                      {formatPrice(r.deal?.finalPrice || r.items.reduce((s, i) => s + i.price * i.quantity, 0))}
                    </div>
                    <Tag
                      color={r.status === 'CLOSED' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'blue'}
                      style={{ fontSize: 11 }}
                    >
                      {r.status === 'CLOSED' ? 'Завершена' : r.status === 'CANCELLED' ? 'Отменена' : 'Активна'}
                    </Tag>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </Drawer>

      <RecordDetailModal
        record={selectedRecord}
        open={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); setSelectedRecord(null); }}
        onRefresh={() => {
          if (selected) {
            clientsApi.getById(selected.id).then(setSelected).catch(() => {});
          }
        }}
      />
    </div>
  );
};
