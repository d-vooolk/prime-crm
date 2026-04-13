import React, { useState } from 'react';
import { Modal, Button, Descriptions, Tag, Divider, Table, message, Popconfirm } from 'antd';
import { PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Record as CrmRecord } from '@/types';
import { formatPrice, formatDate, formatTime } from '@/utils/formatters';
import { printWorkOrder, printCompletionAct } from '@/utils/print';
import { CloseRecordModal } from '../CloseRecordModal';
import { recordsApi } from '@/api/records.api';

interface Props {
  record: CrmRecord | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'blue', label: 'Активна' },
  CLOSED: { color: 'green', label: 'Завершена' },
  CANCELLED: { color: 'red', label: 'Отменена' },
};

export const RecordDetailModal: React.FC<Props> = ({ record, open, onClose, onRefresh }) => {
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  if (!record) return null;

  const status = STATUS_MAP[record.status] || STATUS_MAP.ACTIVE;
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleCancel = async () => {
    try {
      await recordsApi.cancel(record.id);
      message.success('Запись отменена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const serviceColumns = [
    { title: 'Услуга', dataIndex: ['service', 'name'], key: 'name' },
    {
      title: 'Категория', key: 'cat',
      render: (_: unknown, row: typeof record.items[0]) =>
        <Tag>{row.service.category?.name}</Tag>
    },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 80 },
    {
      title: 'Цена', key: 'price', width: 120,
      render: (_: unknown, row: typeof record.items[0]) => formatPrice(row.price),
    },
    {
      title: 'Итого', key: 'total', width: 120,
      render: (_: unknown, row: typeof record.items[0]) =>
        <strong>{formatPrice(row.price * row.quantity)}</strong>,
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={700}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Запись #{record.id.slice(-8).toUpperCase()}
            <Tag color={status.color}>{status.label}</Tag>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button icon={<PrinterOutlined />} onClick={() => printWorkOrder(record)}>
                Заявка
              </Button>
              {record.deal && (
                <Button icon={<PrinterOutlined />} onClick={() => printCompletionAct(record)}>
                  Акт
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {record.status === 'ACTIVE' && (
                <>
                  <Popconfirm title="Отменить запись?" onConfirm={handleCancel} okText="Да" cancelText="Нет">
                    <Button danger icon={<CloseCircleOutlined />}>Отменить</Button>
                  </Popconfirm>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => setCloseModalOpen(true)}
                  >
                    Закрыть сделку
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        <Divider orientation="left" style={{ fontSize: 13 }}>Клиент</Divider>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="ФИО">{record.client.name}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{record.client.phone}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left" style={{ fontSize: 13 }}>Автомобиль</Divider>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Марка / Модель">
            {record.car.brand} {record.car.model}
          </Descriptions.Item>
          <Descriptions.Item label="Год">{record.car.year}</Descriptions.Item>
          {record.car.generationName && (
            <Descriptions.Item label="Поколение">{record.car.generationName}</Descriptions.Item>
          )}
          {record.car.plateNumber && (
            <Descriptions.Item label="Гос. номер">{record.car.plateNumber}</Descriptions.Item>
          )}
        </Descriptions>

        <Divider orientation="left" style={{ fontSize: 13 }}>Запись</Divider>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Дата">{formatDate(record.scheduledAt)}</Descriptions.Item>
          <Descriptions.Item label="Время">{formatTime(record.scheduledAt)}</Descriptions.Item>
          <Descriptions.Item label="Мастер">{record.serviceman}</Descriptions.Item>
        </Descriptions>

        {record.notes && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '8px 0' }}>
            📌 {record.notes}
          </p>
        )}

        <Divider orientation="left" style={{ fontSize: 13 }}>Услуги</Divider>
        <Table
          dataSource={record.items}
          columns={serviceColumns}
          rowKey="id"
          pagination={false}
          size="small"
          footer={() => (
            <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>
              {record.deal ? 'Итого: ' : 'Предв. итого: '}{formatPrice(total)}
            </div>
          )}
        />

        {record.deal && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Сделка закрыта</Divider>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Дата закрытия">
                {formatDate(record.deal.closedAt)}
              </Descriptions.Item>
              {record.deal.warranty && (
                <Descriptions.Item label="Гарантия">{record.deal.warranty}</Descriptions.Item>
              )}
              {record.deal.priceIncreaseReason && (
                <Descriptions.Item label="Обоснование цены" span={2}>
                  {record.deal.priceIncreaseReason}
                </Descriptions.Item>
              )}
              {record.deal.equipment.length > 0 && (
                <Descriptions.Item label="Оборудование" span={2}>
                  {record.deal.equipment.map(e => e.equipment.name).join(', ')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      <CloseRecordModal
        record={record}
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onSuccess={() => { onRefresh(); onClose(); }}
      />
    </>
  );
};
