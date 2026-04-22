import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, Button, Descriptions, Tag, Divider, Table, message,
  Popconfirm, Select, InputNumber, DatePicker, TimePicker, Space, Tooltip, Grid,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined, CalendarOutlined,
  CarOutlined, StarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Record as CrmRecord, Category, Serviceman } from '@/types';
import { SelectedService } from '@/components/RecordModal/types';
import { formatPrice, formatDate, formatTime } from '@/utils/formatters';
import { printWorkOrder, printCompletionAct, printServiceContract, printInvoice, printBlankCompletionAct, printLegalAct } from '@/utils/print';
import { CloseRecordModal } from '../CloseRecordModal';
import { recordsApi } from '@/api/records.api';
import { servicesApi } from '@/api/services.api';
import { useAuthStore } from '@/store/authStore';
import { useNotify } from '@/hooks/useNotify';
import styles from './RecordDetailModal.module.scss';

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuthStore();
  const notify = useNotify();
  const isEmployee = user?.role === 'Сотрудник';
  const canDelete = user?.isMaster || user?.role === 'Создатель';
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [editItems, setEditItems] = useState<SelectedService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editEquipment, setEditEquipment] = useState<import('@/types').Equipment[]>([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<dayjs.Dayjs | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<dayjs.Dayjs | null>(null);
  const [reschedulePerson, setReschedulePerson] = useState('');
  const [rescheduleReceptionist, setRescheduleReceptionist] = useState('');
  const [servicemen, setServicemen] = useState<Serviceman[]>([]);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [smsSending, setSmsSending] = useState<'CAR_READY' | 'REVIEW_REQUEST' | null>(null);
  const timePickerRef = useRef<any>(null);
  const timeCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrintData = async () => {
    const [settings, templates] = await Promise.all([
      servicesApi.getSettings().catch(() => undefined),
      servicesApi.getDocTemplates().catch(() => []),
    ]);
    return { settings, templates };
  };

  const handlePrintWorkOrder = async () => {
    setPrinting(true);
    try {
      const { settings, templates } = await fetchPrintData();
      const categoryId = record.items[0]?.service?.categoryId;
      const template = templates.find(t => t.categoryId === categoryId && t.type === 'work_order')
        || templates.find(t => !t.categoryId && t.type === 'work_order' && t.isDefault)
        || templates.find(t => t.type === 'work_order');
      printWorkOrder(record, settings, template?.content);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAct = async () => {
    setPrinting(true);
    try {
      const { settings, templates } = await fetchPrintData();
      if (record.isLegalEntity) {
        printLegalAct(record, settings);
      } else {
        const actTemplate = templates.find(t => t.type === 'completion_act' && t.isDefault)
          || templates.find(t => t.type === 'completion_act');
        if (record.deal) printCompletionAct(record, settings, actTemplate?.content);
        else printBlankCompletionAct(record, settings, actTemplate?.content);
      }
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintContract = async () => {
    setPrinting(true);
    try {
      const { settings } = await fetchPrintData();
      printServiceContract(record, settings);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintInvoice = async () => {
    setPrinting(true);
    try {
      const { settings } = await fetchPrintData();
      printInvoice(record, settings);
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (open && record) {
      setEditingServices(false);
      setRescheduleOpen(false);
      setRescheduleDate(dayjs(record.scheduledAt));
      setRescheduleTime(dayjs(record.scheduledAt));
      setReschedulePerson(record.serviceman);
      setRescheduleReceptionist(record.receptionist || '');
    }
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!record) return null;

  const status = STATUS_MAP[record.status] || STATUS_MAP.ACTIVE;
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  // ─── Service editing ──────────────────────────────

  const handleStartEditServices = async () => {
    const [cats, equip] = await Promise.all([
      categories.length === 0 ? servicesApi.getCategories().catch(() => []) : Promise.resolve(categories),
      editEquipment.length === 0 ? servicesApi.getEquipment().catch(() => []) : Promise.resolve(editEquipment),
    ]);
    if (cats !== categories) setCategories(cats);
    if (equip !== editEquipment) setEditEquipment(equip);
    setEditItems(record.items.map(item => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      categoryName: item.service.category?.name || '',
      price: item.price,
      quantity: item.quantity,
      estimatedTime: item.service.estimatedTime,
      hasEquipment: item.service.hasEquipment ?? false,
      equipmentId: item.equipmentId ?? undefined,
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
        hasEquipment: service.hasEquipment ?? false,
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
          equipmentId: s.equipmentId,
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
    if (!rescheduleDate || !rescheduleTime) {
      message.warning('Укажите дату и время');
      return;
    }
    const scheduledAt = rescheduleDate
      .hour(rescheduleTime.hour())
      .minute(rescheduleTime.minute())
      .second(0)
      .toISOString();
    setSaving(true);
    try {
      await recordsApi.update(record.id, {
        scheduledAt,
        serviceman: reschedulePerson,
        receptionist: rescheduleReceptionist,
      });
      message.success('Запись обновлена');
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

  const handleDelete = async () => {
    try {
      await recordsApi.delete(record.id);
      message.success('Запись удалена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleSendSms = async (type: 'CAR_READY' | 'REVIEW_REQUEST') => {
    setSmsSending(type);
    try {
      await recordsApi.sendSms(record.id, type);
      message.success(type === 'CAR_READY' ? 'SMS «Авто готово» отправлено' : 'SMS запроса отзыва отправлено');
      onRefresh();
    } catch {
      message.error('Не удалось отправить SMS');
    } finally {
      setSmsSending(null);
    }
  };

  // ─── Column definitions ───────────────────────────

  const handleOpenCloseModal = () => {
    const missingEquipment = record.items.filter(i => i.service.hasEquipment && !i.equipmentId);
    if (missingEquipment.length > 0) {
      notify.warning(
        'Необходимо выбрать оборудование',
        `Укажите Bi-Led модуль для: ${missingEquipment.map(i => i.service.name).join(', ')}`,
      );
      return;
    }
    setCloseModalOpen(true);
  };

  const serviceOptions = categories.map(cat => ({
    label: cat.name,
    options: cat.services.map(s => ({
      value: s.id,
      label: `${s.name} — ${formatPrice(s.standardPrice)}`,
    })),
  }));

  const employees = servicemen.filter(s => !s.isReceptionist && !s.isDismissed);
  const receptionists = servicemen.filter(s => s.isReceptionist && !s.isDismissed);

  const editEquipmentOptions = editEquipment.map(e => ({ value: e.id, label: e.name }));

  const editColumns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: SelectedService) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Tag style={{ fontSize: 11, marginTop: 2 }}>{row.categoryName}</Tag>
          {row.hasEquipment && (
            <Select
              size="small"
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Выберите Bi-Led модуль..."
              value={row.equipmentId || undefined}
              onChange={v => setEditItems(prev => prev.map(s => s.serviceId === row.serviceId ? { ...s, equipmentId: v } : s))}
              allowClear
              onClear={() => setEditItems(prev => prev.map(s => s.serviceId === row.serviceId ? { ...s, equipmentId: undefined } : s))}
              options={editEquipmentOptions}
              showSearch
              optionFilterProp="label"
            />
          )}
        </div>
      ),
    },
    {
      title: 'Кол-во', key: 'quantity', width: 100,
      render: (_: unknown, row: SelectedService) => (
        <InputNumber
          min={1} max={99} value={row.quantity} size="small"
          controls
          style={{ width: 80 }}
          onChange={v => setEditItems(prev =>
            prev.map(s => s.serviceId === row.serviceId ? { ...s, quantity: v || 1 } : s)
          )}
        />
      ),
    },
    {
      title: 'Цена', key: 'price', width: 150,
      render: (_: unknown, row: SelectedService) => (
        <Space.Compact size="small">
          <InputNumber
            min={0} value={row.price} style={{ width: 100 }}
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
    ...(!isEmployee ? [
      {
        title: 'Цена', key: 'price', width: 120,
        render: (_: unknown, row: typeof record.items[0]) => formatPrice(row.price),
      },
      {
        title: 'Итого', key: 'total', width: 120,
        render: (_: unknown, row: typeof record.items[0]) =>
          <strong>{formatPrice(row.price * row.quantity)}</strong>,
      },
    ] : []),
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={700}
        className={styles.modal}
        classNames={{
          wrapper: styles.modalWrap,
          content: styles.modalContent,
          body: styles.modalBody,
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Запись #{record.id.slice(-8).toUpperCase()}
            <Tag color={status.color}>{status.label}</Tag>
          </div>
        }
        footer={isMobile ? (
          // ─── Mobile footer ──────────────────────────
          <div className={styles.footerMobile}>
            {record.status === 'ACTIVE' && !isEmployee && (
              <>
                {/* Row 1: Редактировать + Отменить */}
                <div className={styles.footerMobileRow}>
                  <Button
                    icon={<CalendarOutlined />}
                    onClick={handleOpenReschedule}
                    className={styles.footerMobileFlex}
                  >
                    Редактировать
                  </Button>
                  <Popconfirm title="Отменить запись?" onConfirm={handleCancel} okText="Да" cancelText="Нет">
                    <Button danger icon={<CloseCircleOutlined />} className={styles.footerMobileFlex}>
                      Отменить
                    </Button>
                  </Popconfirm>
                </div>
                {/* Row 2: Закрыть сделку */}
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  block
                  onClick={handleOpenCloseModal}
                >
                  Закрыть сделку
                </Button>
              </>
            )}
            {record.status === 'CANCELLED' && !isEmployee && (
              <Popconfirm title="Восстановить запись?" onConfirm={handleRestore} okText="Да" cancelText="Нет">
                <Button type="primary" icon={<ReloadOutlined />} block>Восстановить</Button>
              </Popconfirm>
            )}
            {/* Row 3: SMS иконки + Заявка + Удалить */}
            {!isEmployee && (
              <div className={styles.footerMobileRow}>
                {(record.status === 'ACTIVE' || record.status === 'CLOSED') && (
                  <>
                    <Popconfirm
                      title="Отправить SMS «Авто готово»?"
                      description={`На номер ${record.client.phone}`}
                      onConfirm={() => handleSendSms('CAR_READY')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Button icon={<CarOutlined />} loading={smsSending === 'CAR_READY'} />
                    </Popconfirm>
                    <Popconfirm
                      title="Отправить запрос отзыва?"
                      description={`На номер ${record.client.phone}`}
                      onConfirm={() => handleSendSms('REVIEW_REQUEST')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Button icon={<StarOutlined />} loading={smsSending === 'REVIEW_REQUEST'} />
                    </Popconfirm>
                  </>
                )}
                <Button
                  icon={<PrinterOutlined />}
                  loading={printing}
                  onClick={record.isLegalEntity ? handlePrintContract : handlePrintWorkOrder}
                  className={styles.footerMobileFlex}
                >
                  {record.isLegalEntity ? 'Договор' : 'Заявка'}
                </Button>
                {canDelete && (
                  <Popconfirm
                    title="Удалить запись?"
                    description="Запись и все связанные данные будут удалены безвозвратно."
                    onConfirm={handleDelete}
                    okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена"
                  >
                    <Button danger icon={<DeleteOutlined />} className={styles.footerMobileFlex}>
                      Удалить
                    </Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </div>
        ) : (
          // ─── Desktop footer ──────────────────────────
          <div className={styles.footer}>
            <div className={styles.footerDelete}>
              {canDelete && (
                <Popconfirm
                  title="Удалить запись?"
                  description="Запись и все связанные данные будут удалены безвозвратно."
                  onConfirm={handleDelete}
                  okText="Удалить"
                  okButtonProps={{ danger: true }}
                  cancelText="Отмена"
                >
                  <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                </Popconfirm>
              )}
            </div>
            {!isEmployee && (
              <div className={styles.footerSecondary}>
                {(record.status === 'ACTIVE' || record.status === 'CLOSED') && (
                  <>
                    <Popconfirm
                      title="Отправить SMS «Авто готово»?"
                      description={`На номер ${record.client.phone}`}
                      onConfirm={() => handleSendSms('CAR_READY')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Tooltip title="Авто готово">
                        <Button icon={<CarOutlined />} loading={smsSending === 'CAR_READY'} />
                      </Tooltip>
                    </Popconfirm>
                    <Popconfirm
                      title="Отправить запрос отзыва?"
                      description={`На номер ${record.client.phone}`}
                      onConfirm={() => handleSendSms('REVIEW_REQUEST')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Tooltip title="Запросить отзыв">
                        <Button icon={<StarOutlined />} loading={smsSending === 'REVIEW_REQUEST'} />
                      </Tooltip>
                    </Popconfirm>
                  </>
                )}
                {record.isLegalEntity ? (
                  <>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintContract}>Договор</Button>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintInvoice}>Счёт</Button>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintAct}>Акт</Button>
                  </>
                ) : (
                  <>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintWorkOrder}>Заявка</Button>
                    {record.deal && (
                      <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintAct}>Акт</Button>
                    )}
                  </>
                )}
              </div>
            )}
            {!isEmployee && (
              <div className={styles.footerPrimary}>
                {record.status === 'ACTIVE' && (
                  <>
                    <Button icon={<CalendarOutlined />} onClick={handleOpenReschedule}>Редактировать</Button>
                    <Popconfirm title="Отменить запись?" onConfirm={handleCancel} okText="Да" cancelText="Нет">
                      <Button danger icon={<CloseCircleOutlined />}>Отменить</Button>
                    </Popconfirm>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleOpenCloseModal}>
                      Закрыть сделку
                    </Button>
                  </>
                )}
                {record.status === 'CANCELLED' && (
                  <Popconfirm title="Восстановить запись?" onConfirm={handleRestore} okText="Да" cancelText="Нет">
                    <Button type="primary" icon={<ReloadOutlined />}>Восстановить</Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </div>
        )}
      >
        <Divider orientation="left" style={{ fontSize: 13 }}>Клиент</Divider>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label={record.isLegalEntity ? 'ФИО представителя' : 'ФИО'}>
            <span className={isEmployee ? styles.blurred : undefined}>{record.client.name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Телефон">
            <span className={isEmployee ? styles.blurred : undefined}>{record.client.phone}</span>
          </Descriptions.Item>
        </Descriptions>

        {record.isLegalEntity && !isEmployee && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Юридическое лицо</Divider>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              {record.legalCompanyName && (
                <Descriptions.Item label="Организация" span={2}>{record.legalCompanyName}</Descriptions.Item>
              )}
              {record.legalAddress && (
                <Descriptions.Item label="Юр. адрес" span={2}>{record.legalAddress}</Descriptions.Item>
              )}
              {record.legalUnp && <Descriptions.Item label="УНП">{record.legalUnp}</Descriptions.Item>}
              {record.legalBic && <Descriptions.Item label="БИК">{record.legalBic}</Descriptions.Item>}
              {record.legalOkpo && <Descriptions.Item label="ОКПО">{record.legalOkpo}</Descriptions.Item>}
              {record.legalPhone && <Descriptions.Item label="Телефон орг.">{record.legalPhone}</Descriptions.Item>}
              {record.legalEmail && <Descriptions.Item label="Email орг.">{record.legalEmail}</Descriptions.Item>}
            </Descriptions>
          </>
        )}

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
          {record.serviceman && (
            <Descriptions.Item label="Сотрудник">{record.serviceman}</Descriptions.Item>
          )}
          {record.receptionist && (
            <Descriptions.Item label="Мастер приёмщик">{record.receptionist}</Descriptions.Item>
          )}
        </Descriptions>

        {record.notes && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '8px 0' }}>
            📌 {record.notes}
          </p>
        )}

        <Divider orientation="left" style={{ fontSize: 13 }}>Услуги</Divider>
        {record.status === 'ACTIVE' && !record.deal && !editingServices && !isEmployee && (
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
            footer={isEmployee ? undefined : () => (
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
                <Descriptions.Item label="Bi-Led модули" span={2}>
                  {record.deal.equipment.map(e => e.equipment.name).join(', ')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      {/* Редактирование записи */}
      <Modal
        title="Редактировать запись"
        open={rescheduleOpen}
        onCancel={() => setRescheduleOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRescheduleOpen(false)}>Отмена</Button>,
          <Button key="save" type="primary" loading={saving} onClick={handleSaveReschedule}>
            Сохранить
          </Button>,
        ]}
        width={400}
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
              ref={timePickerRef}
              value={rescheduleTime}
              onChange={t => {
                setRescheduleTime(t);
                if (timeCloseTimer.current) clearTimeout(timeCloseTimer.current);
                timeCloseTimer.current = setTimeout(() => {
                  timePickerRef.current?.blur();
                  timeCloseTimer.current = null;
                }, 600);
              }}
              format="HH:mm"
              minuteStep={5}
              needConfirm={false}
              disabledTime={() => ({ disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23] })}
              hideDisabledOptions
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Сотрудник</div>
            <Select
              style={{ width: '100%' }}
              value={reschedulePerson || undefined}
              onChange={v => setReschedulePerson(v ?? '')}
              placeholder="Выберите сотрудника"
              allowClear
              options={employees.map(s => ({ value: s.name, label: s.name }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Мастер приёмщик</div>
            <Select
              style={{ width: '100%' }}
              value={rescheduleReceptionist || undefined}
              onChange={v => setRescheduleReceptionist(v ?? '')}
              placeholder="Выберите мастера"
              allowClear
              options={receptionists.map(s => ({ value: s.name, label: s.name }))}
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
