import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, Button, Divider, message,
  Table, Empty, Checkbox, Tag, Tooltip, InputNumber,
} from 'antd';
import { useNotify } from '@/hooks/useNotify';
import { TeamOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Record, Serviceman } from '@/types';
import { servicesApi } from '@/api/services.api';
import { recordsApi } from '@/api/records.api';
import { formatPrice } from '@/utils/formatters';
import { DealCelebration } from '../DealCelebration';
import styles from './CloseRecordModal.module.scss';

interface ServicemanSplitEntry {
  name: string;
  amount: number;
}

interface ItemRow {
  serviceId: string;
  itemId: string;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  estimatedTime: number;
  netProfit: number;
  servicemanName: string;
  hasEquipment: boolean;
  isProduct: boolean;
  equipmentId?: string;
  split?: ServicemanSplitEntry[] | null;
}

interface Props {
  record: Record;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WARRANTY_OPTIONS = [
  { value: 'Без гарантии', label: 'Без гарантии' },
  { value: '1 месяц', label: '1 месяц' },
  { value: '6 месяцев', label: '6 месяцев' },
  { value: '1 год', label: '1 год' },
];

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Serviceman[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);

  // Split modal state
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitItemId, setSplitItemId] = useState<string | null>(null);
  const [splitEntries, setSplitEntries] = useState<ServicemanSplitEntry[]>([]);

  const notify = useNotify();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      servicesApi.getAllServicemen().then(all =>
        setEmployees(all.filter(s => s.role === 'Сотрудник' && !s.isDismissed))
      ).catch(() => {});

      setItems(record.items.map(i => {
        const hasEquipment = i.service.hasEquipment ?? false;
        const isProduct = i.service.isProduct ?? false;
        const retailPrice = hasEquipment ? (i.equipment?.retailPrice ?? 0) : 0;
        return {
          serviceId: i.serviceId,
          itemId: i.id,
          serviceName: i.service.name,
          categoryName: i.service.category?.name || '',
          price: i.price,
          quantity: i.quantity,
          estimatedTime: i.service.estimatedTime || 0,
          netProfit: isProduct ? 0 : i.price * i.quantity - retailPrice,
          servicemanName: isProduct || i.servicemanSplit?.length
            ? ''
            : (i.servicemanName ?? record.serviceman),
          hasEquipment,
          isProduct,
          equipmentId: i.equipmentId ?? undefined,
          split: !isProduct && i.servicemanSplit?.length ? i.servicemanSplit : null,
        };
      }));

      if (record.deal) {
        form.setFieldsValue({
          defects: record.deal.defects || '',
          warranty: record.deal.warranty || '',
          isPaidByBankTransfer: record.deal.isPaidByBankTransfer || false,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, record, form]);

  const updateItemServiceman = (itemId: string, servicemanName: string) => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, servicemanName, split: null } : i));
  };

  const openSplitModal = (row: ItemRow) => {
    setSplitItemId(row.itemId);
    if (row.split && row.split.length >= 2) {
      setSplitEntries(row.split);
    } else {
      setSplitEntries([
        { name: row.servicemanName || record.serviceman, amount: row.netProfit },
        { name: '', amount: 0 },
      ]);
    }
    setSplitOpen(true);
  };

  const saveSplit = () => {
    const valid = splitEntries.filter(e => e.name);
    if (valid.length < 2) {
      notify.warning('Укажите минимум двух сотрудников');
      return;
    }
    const totalAmount = valid.reduce((s, e) => s + (e.amount || 0), 0);
    if (splitItem && totalAmount > splitItem.netProfit + 0.01) {
      notify.warning(
        'Сумма превышает чистую прибыль',
        `Указано: ${formatPrice(totalAmount)}, чистая прибыль услуги: ${formatPrice(splitItem.netProfit)}`,
      );
      return;
    }
    setItems(prev => prev.map(i =>
      i.itemId === splitItemId
        ? { ...i, split: valid, servicemanName: '' }
        : i
    ));
    setSplitOpen(false);
  };

  const cancelSplit = (itemId: string) => {
    setItems(prev => prev.map(i =>
      i.itemId === itemId
        ? { ...i, split: null, servicemanName: record.serviceman }
        : i
    ));
  };

  const hasEmployees = employees.length > 0;

  const employeeOptions = employees.map(e => ({ value: e.name, label: e.name }));

  const itemColumns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: ItemRow) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{row.categoryName}</div>
          </div>
          {hasEmployees && !row.isProduct && (
            <Tooltip title="Разделить между сотрудниками">
              <Button
                type="text"
                size="small"
                icon={<TeamOutlined style={{ color: row.split?.length ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />}
                onClick={() => openSplitModal(row)}
                style={{ marginTop: 1, padding: '0 4px' }}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Сумма',
      key: 'total',
      width: 100,
      render: (_: unknown, row: ItemRow) => (
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: 'Чистая прибыль',
      key: 'netProfit',
      width: 130,
      render: (_: unknown, row: ItemRow) =>
        row.isProduct
          ? <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
          : <span style={{ fontWeight: 600, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>{formatPrice(row.netProfit)}</span>,
    },
    ...(hasEmployees ? [{
      title: 'Сотрудник',
      key: 'serviceman',
      width: 180,
      render: (_: unknown, row: ItemRow) => {
        if (row.isProduct) {
          return <Tag color="orange" style={{ margin: 0 }}>Товар</Tag>;
        }
        if (row.split && row.split.length >= 2) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Tooltip title={row.split.map(s => `${s.name}: ${formatPrice(s.amount)}`).join(' / ')}>
                <Tag color="blue" style={{ cursor: 'pointer', margin: 0 }}>
                  {row.split.map(s => s.name).join(', ')}
                </Tag>
              </Tooltip>
              <Button
                type="text"
                size="small"
                style={{ padding: '0 4px', fontSize: 11, color: 'var(--color-text-secondary)' }}
                onClick={() => cancelSplit(row.itemId)}
              >
                ✕
              </Button>
            </div>
          );
        }
        return (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={row.servicemanName || undefined}
            placeholder="Сотрудник"
            onChange={(v: string) => updateItemServiceman(row.itemId, v)}
            options={employeeOptions}
          />
        );
      },
    }] : []),
  ];

  const missingServiceman = hasEmployees
    ? items.filter(i => !i.isProduct && !(i.split && i.split.length >= 2) && !i.servicemanName)
    : [];

  const handleClose = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    if (missingServiceman.length > 0) {
      notify.warning(
        'Укажите сотрудника',
        `Не указан сотрудник для: ${missingServiceman.map(i => i.serviceName).join(', ')}`,
      );
      return;
    }

    setLoading(true);
    try {
      await recordsApi.update(record.id, {
        items: items.map(i => ({
          serviceId: i.serviceId,
          price: i.price,
          quantity: i.quantity,
          servicemanName: i.split?.length ? undefined : i.servicemanName,
          equipmentId: i.equipmentId,
          servicemanSplit: i.split?.length ? i.split : null,
        })),
      });

      await recordsApi.close(record.id, {
        finalPrice: items.reduce((s, i) => s + i.price * i.quantity, 0),
        defects: values.defects || undefined,
        warranty: values.warranty || undefined,
        isPaidByBankTransfer: values.isPaidByBankTransfer || false,
      });

      onClose();
      setCelebrating(true);
      setTimeout(() => onSuccess(), 2100);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const splitItem = items.find(i => i.itemId === splitItemId);

  return (
    <>
      {celebrating && <DealCelebration onDone={() => setCelebrating(false)} />}

      {/* Split employees modal */}
      <Modal
        open={splitOpen}
        onCancel={() => setSplitOpen(false)}
        title={splitItem ? `Разделить: ${splitItem.serviceName}` : 'Разделить между сотрудниками'}
        width={480}
        footer={null}
        destroyOnClose
      >
        {splitItem && (
          <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Чистая прибыль по услуге: <strong style={{ color: 'var(--color-success)' }}>{formatPrice(splitItem.netProfit)}</strong>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {splitEntries.map((entry, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select
                style={{ flex: 1 }}
                placeholder="Сотрудник"
                value={entry.name || undefined}
                onChange={v => setSplitEntries(prev => prev.map((e, i) => i === idx ? { ...e, name: v } : e))}
                options={employeeOptions}
              />
              <InputNumber
                style={{ width: 130 }}
                placeholder="Сумма"
                min={0}
                value={entry.amount || undefined}
                onChange={v => setSplitEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: v ?? 0 } : e))}
                suffix="BYN"
              />
              {splitEntries.length > 2 && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setSplitEntries(prev => prev.filter((_, i) => i !== idx))}
                />
              )}
            </div>
          ))}
        </div>

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setSplitEntries(prev => [...prev, { name: '', amount: 0 }])}
          style={{ width: '100%', marginTop: 12 }}
        >
          Добавить сотрудника
        </Button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setSplitOpen(false)}>Отмена</Button>
          <Button type="primary" onClick={saveSplit}>Сохранить</Button>
        </div>
      </Modal>

      <Modal
        open={open}
        onCancel={onClose}
        title="Закрыть сделку"
        width={hasEmployees ? 820 : 620}
        footer={null}
        destroyOnClose
        className={styles.modal}
        classNames={{
          wrapper: styles.modalWrap,
          content: styles.modalContent,
          body: styles.modalBody,
        }}
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ fontSize: 13 }}>Перечень работ</Divider>

          {items.length === 0 ? (
            <Empty description="Нет услуг" style={{ margin: '16px 0' }} />
          ) : (
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="itemId"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              style={{ marginBottom: 8 }}
              footer={() => (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{formatPrice(total)}</span>
                </div>
              )}
            />
          )}

          <Divider orientation="left" style={{ fontSize: 13 }}>Дефекты</Divider>

          <Form.Item label="Обнаруженные недостатки в процессе работы" name="defects">
            <Input.TextArea rows={3} placeholder="Описание дефектов, обнаруженных в ходе выполнения работ" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Гарантия</Divider>

          <Form.Item label="Гарантия на работу" name="warranty">
            <Select
              placeholder="Выберите срок гарантии"
              allowClear
              options={WARRANTY_OPTIONS}
            />
          </Form.Item>

          <Form.Item name="isPaidByBankTransfer" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Оплата по расчётному счёту (РС)</Checkbox>
          </Form.Item>

          <div className={styles.footer}>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" loading={loading} onClick={handleClose}>
              Завершить сделку
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};
