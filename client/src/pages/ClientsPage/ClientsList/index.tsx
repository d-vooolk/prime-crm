import React from 'react';
import { List, Table, Tag } from 'antd';
import { PhoneOutlined, UserOutlined } from '@ant-design/icons';
import type { Car, Client } from '@/types';
import { formatDate } from '@/utils/formatters';
import { carLabel, matchedCars, telHref } from '../clientsHelpers';
import styles from './ClientsList.module.scss';

interface Props {
  clients: Client[];
  loading: boolean;
  isMobile: boolean;
  /** Включён фильтр по услуге/периоду — показываем подошедшие визиты */
  recordFilterActive: boolean;
  /** Фильтр по услуге — заголовок колонки визитов */
  serviceSelected: boolean;
  onSelectClient: (clientId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

/** Список клиентов: таблица на десктопе, карточки на телефоне */
export const ClientsList: React.FC<Props> = ({
  clients, loading, isMobile, recordFilterActive, serviceSelected, onSelectClient, onSelectRecord,
}) => {
  const renderCarTag = (car: Car, className?: string) => (
    <Tag key={car.id} className={className}>
      {carLabel(car)}
      {car.plateNumber && <span className={styles.plate}>{car.plateNumber}</span>}
    </Tag>
  );

  /** Подошедшие под фильтр визиты: дата и машина, клик открывает запись */
  const renderMatchedRecords = (client: Client) => (
    <div className={styles.matched}>
      {(client.matchedRecords ?? []).map(r => (
        <button
          key={r.id}
          type="button"
          className={styles.matchedRecord}
          onClick={e => { e.stopPropagation(); onSelectRecord(r.id); }}
        >
          <span className={styles.matchedDate}>{formatDate(r.scheduledAt)}</span>
          {carLabel(r.car)}
          {r.car.plateNumber && <span className={styles.plate}>{r.car.plateNumber}</span>}
        </button>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <List
        dataSource={clients}
        loading={loading}
        locale={{ emptyText: 'Клиенты не найдены' }}
        pagination={clients.length > 20 ? { pageSize: 20, align: 'center', size: 'small' } : false}
        renderItem={(client: Client) => (
          <List.Item className={styles.mobileItem} onClick={() => onSelectClient(client.id)}>
            <div className={styles.mobileCard}>
              <div className={styles.mobileCardTop}>
                <span className={styles.mobileName}>
                  <UserOutlined className={styles.mobileNameIcon} />
                  {client.name}
                </span>
                <span className={styles.mobileVisits}>
                  {client._count?.records || 0} зап.
                </span>
              </div>
              {/* Тап по номеру звонит, тап по остальной карточке открывает историю */}
              <a
                href={telHref(client.phone)}
                className={styles.mobilePhone}
                onClick={e => e.stopPropagation()}
              >
                <PhoneOutlined />
                {client.phone}
              </a>
              {recordFilterActive ? renderMatchedRecords(client) : client.cars.length > 0 && (
                <div className={styles.mobileCars}>
                  {client.cars.map(car => renderCarTag(car, styles.mobileCarTag))}
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
    );
  }

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'name',
      key: 'name',
      render: (clientName: string) => (
        <span className={styles.name}>
          <UserOutlined className={styles.nameIcon} />
          {clientName}
        </span>
      ),
    },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Автомобили',
      key: 'cars',
      render: (_: unknown, row: Client) => (
        <div className={styles.cars}>
          {(recordFilterActive ? matchedCars(row) : row.cars).map(car => renderCarTag(car))}
        </div>
      ),
    },
    ...(recordFilterActive ? [{
      title: serviceSelected ? 'Когда делали услугу' : 'Записи за период',
      key: 'matched',
      render: (_: unknown, row: Client) => renderMatchedRecords(row),
    }] : []),
    {
      title: 'Записей',
      key: 'visits',
      width: 100,
      render: (_: unknown, row: Client) => row._count?.records || 0,
    },
  ];

  return (
    <Table
      dataSource={clients}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="middle"
      locale={{ emptyText: 'Клиенты не найдены' }}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      rowClassName={styles.row}
      onRow={(row) => ({
        onClick: () => onSelectClient(row.id),
      })}
    />
  );
};
