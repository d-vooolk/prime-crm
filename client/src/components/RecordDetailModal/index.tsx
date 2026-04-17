import React, { useState, useEffect } from 'react';
import {
  Modal, Button, Descriptions, Tag, Divider, Table, message,
  Popconfirm, Select, InputNumber, DatePicker, TimePicker, Space,
} from 'antd';
import {
  PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Record as CrmRecord, Category, Serviceman } from '@/types';
import { SelectedService } from '@/components/RecordModal/types';
import { formatPrice, formatDate, formatTime } from '@/utils/formatters';
import { printWorkOrder, printCompletionAct } from '@/utils/print';
import { CloseRecordModal } from '../CloseRecordModal';
import { recordsApi } from '@/api/records.api';
import { servicesApi } from '@/api/services.api';

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
  const [editingServices, setEditingServices] = useState(false);
  const [editItems, setEditItems] = useState<SelectedService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<dayjs.Dayjs | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<dayjs.Dayjs | null>(null);
  const [reschedulePerson, setReschedulePerson] = useState('');
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && record) {
      setEditingServices(false);
      setRescheduleOpen(false);
      setRescheduleDate(dayjs(record.scheduledAt));
      setRescheduleTime(dayjs(record.scheduledAt));
      setReschedulePerson(record.serviceman);
    }
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!record) return null;

  const status = STATUS_MAP[record.status] || STATUS_MAP.ACTIVE;
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  // ─── Service editing ──────────────────────────────

  const handleStartEditServices = async () => {
    if (categories.length === 0) {
      const cats = await servicesApi.getCategories().catch(() => []);
      setCategories(cats);
    }
    setEditItems(record.items.map(item => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      categoryName: item.service.category?.name || '',
      price: item.price,
      quantity: item.quantity,
      estimatedTime: item.service.estimatedTime,
    })));
    setEditingServices(true);
  };

  const allServices = categories.flatMap(c => c.services.map(s => ({ ...s, category: c })));

  const handleServiceAdd = (serviceId: string) => {
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;
    const existing = editItems.find(s => s.serviceId === serviceId);
    if (existing) {
      setEditItems(prev => prev.map(s =>
        s.serviceId === serviceId ? { ...s, quantity: s.quantity + 1 } : s
      ));
    } else {
      setEditItems(prev => [...prev, {
        serviceId: service.id,
        serviceName: service.name,
        categoryName: service.category.name,
        price: service.standardPrice,
        quantity: 1,
        estimatedTime: service.estimatedTime,
      }]);
    }
  };

  const handleSaveServices = async () => {
    setSaving(true);
    try {
      await recordsApi.update(record.id, {
        items: editItems.map(s => ({
          serviceId: s.serviceId,
          price: s.price,
          quantity: s.quantity,
        })),
      });
      message.success('Услуги обновлены');
      setEditingServices(false);
      onRefresh();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  // ─── Reschedule ───────────────────────────────────

  const handleOpenReschedule = async () => {
    if (servicemen.length === 0) {
      const sm = await servicesApi.getServicemen().catch(() => []);
      setServicemen(sm);
    }
    setRescheduleOpen(true);
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime || !reschedulePerson) {
      message.warning('Заполните все поля');
      return;
    }
    const scheduledAt = rescheduleDate
      .hour(rescheduleTime.hour())
      .minute(rescheduleTime.minute())
      .second(0)
      .toISOString();
    setSaving(true);
    try {
      await recordsApi.update(record.id, { scheduledAt, serviceman: reschedulePerson });
      message.success('Запись перенесена');
      setRescheduleOpen(false);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  // ─── Cancel / Restore ─────────────────────────────

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

  const handleRestore = async () => {
    try {
      await recordsApi.restore(record.id);
      message.success('Запись восстановлена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  // ─── Column definitions ───────────────────────────

  const serviceOptions = categories.map(cat => ({
    label: cat.name,
    options: cat.services.map(s => ({
      value: s.id,
      label: `${s.name} — ${formatPrice(s.standardPrice)}`,
    })),
  }));

  const editColumns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: SelectedService) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Tag style={{ fontSize: 11, marginTop: 2 }}>{row.categoryName}</Tag>
        </div>
      ),
    },
    {
      title: 'Кол-во', key: 'quantity', width: 90,
      render: (_: unknown, row: SelectedService) => (
        <InputNumber
          min={1} max={99} value={row.quantity} size="small" style={{ width: 65 }}
          onChange={v => setEditItems(prev =>
            prev.map(s => s.serviceId === row.serviceId ? { ...s, quantity: v || 1 } : s)
          )}
        />
      ),
    },
    {
      title: 'Цена', key: 'price', width: 140,
      render: (_: unknown, row: SelectedService) => (
        <Space.Compact size="small">
          <InputNumber
            min={0} value={row.price} style={{ width: 90 }}
            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            onChange={v => setEditItems(prev =>
              prev.map(s => s.serviceId === row.serviceId ? { ...s, price: v || 0 } : s)
            )}
          />
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '0 8px',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderLeft: 'none', borderRadius: '0 6px 6px 0', fontSize: 13,
            color: 'var(--color-text-secondary)',
          }}>р.</span>
        </Space.Compact>
      ),
    },
    {
      title: '', key: 'action', width: 40,
      render: (_: unknown, row: SelectedService) => (
        <Button
          type="text" danger icon={<DeleteOutlined />} size="small"
          onClick={() => setEditItems(prev => prev.filter(s => s.serviceId !== row.serviceId))}
        />
      ),
    },
  ];

  const viewColumns = [
    { title: 'Услуга', dataIndex: ['service', 'name'], key: 'name' },
    {
      title: 'Категория', key: 'cat',
      render: (_: unknown, row: typeof record.items[0]) =>
        <Tag>{row.service.category?.name}</Tag>,
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
                  <Button icon={<CalendarOutlined />} onClick={handleOpenReschedule}>
                    Перенести
                  </Button>
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
              {record.status === 'CANCELLED' && (
                <Popconfirm title="Восстановить запись?" onConfirm={handleRestore} okText="Да" cancelText="Нет">
                  <Button type="primary" icon={<ReloadOutlined />}>
                    Восстановить
                  </Button>
                </Popconfirm>
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
        {record.status === 'ACTIVE' && !record.deal && !editingServices && (
          <div style={{ marginBottom: 8, textAlign: 'right' }}>
            <Button size="small" icon={<EditOutlined />} onClick={handleStartEditServices}>
              Изменить услуги
            </Button>
          </div>
        )}

        {editingServices ? (
          <div style={{ marginTop: 8 }}>
            <Select
              showSearch
              style={{ width: '100%', marginBottom: 12 }}
              value={undefined}
              onChange={handleServiceAdd}
              placeholder="Добавить услугу..."
              optionFilterProp="label"
              options={serviceOptions}
            />
            <Table
              dataSource={editItems}
              columns={editColumns}
              rowKey="serviceId"
              pagination={false}
              size="small"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditingServices(false)}>Отмена</Button>
              <Button type="primary" loading={saving} onClick={handleSaveServices}>
                Сохранить
              </Button>
            </div>
          </div>
        ) : (
          <Table
            dataSource={record.items}
            columns={viewColumns}
            rowKey="id"
            pagination={false}
            size="small"
            footer={() => (
              <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>
                {record.deal ? 'Итого: ' : 'Предв. итого: '}{formatPrice(total)}
              </div>
            )}
          />
        )}

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

      <Modal
        title="Перенос записи"
        open={rescheduleOpen}
        onCancel={() => setRescheduleOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRescheduleOpen(false)}>Отмена</Button>,
          <Button key="save" type="primary" loading={saving} onClick={handleSaveReschedule}>
            Перенести
          </Button>,
        ]}
        width={380}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Дата</div>
            <DatePicker
              style={{ width: '100%' }}
              value={rescheduleDate}
              onChange={setRescheduleDate}
              format="DD.MM.YYYY"
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Время</div>
            <TimePicker
              style={{ width: '100%' }}
              value={rescheduleTime}
              onChange={setRescheduleTime}
              format="HH:mm"
              minuteStep={5}
              disabledTime={() => ({ disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23] })}
              hideDisabledOptions
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Мастер-приёмщик</div>
            <Select
              style={{ width: '100%' }}
              value={reschedulePerson || undefined}
              onChange={setReschedulePerson}
              placeholder="Выберите мастера"
              options={servicemen.map(s => ({ value: s.name, label: s.name }))}
            />
          </div>
        </div>
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
