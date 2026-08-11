import React, { useState, useEffect } from 'react';
import { Input, Table, Tag } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { clientsApi } from '@/api/clients.api';
import { recordsApi } from '@/api/records.api';
import { Client, Record } from '@/types';
import { RecordDetailModal } from '@/components/RecordDetailModal';
import { ClientHistoryDrawer } from '@/components/ClientHistoryDrawer';
import styles from './ClientsPage.module.scss';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  // Инкремент заставляет панель перечитать клиента после правки записи
  const [historyRefresh, setHistoryRefresh] = useState(0);

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
          onClick: () => setSelectedClientId(row.id),
        })}
      />

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
