import React, { useState, useEffect } from 'react';
import {
  Modal, Form, InputNumber, Input, Select, Button, Divider, message,
  Table, Empty, Checkbox,
} from 'antd';
// InputNumber используется в таблице услуг
import { PrinterOutlined, DeleteOutlined } from '@ant-design/icons';
import { Record, Equipment, Category, DocumentTemplate, Serviceman } from '@/types';
import { servicesApi } from '@/api/services.api';
import { recordsApi } from '@/api/records.api';
import { formatPrice } from '@/utils/formatters';
import { printCompletionAct } from '@/utils/print';
import { DealCelebration } from '../DealCelebration';

interface ItemRow {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  estimatedTime: number;
  netProfit: number;
  servicemanName: string;
}

interface Props {
  record: Record;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Serviceman[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      servicesApi.getEquipment().then(setEquipment).catch(() => {});
      servicesApi.getCategories().then(setCategories).catch(() => {});
      servicesApi.getAllServicemen().then(all => setEmployees(all.filter(s => s.role === 'Сотрудник' && !s.isDismissed))).catch(() => {});

      const initialItems: ItemRow[] = record.items.map(i => ({
        serviceId: i.serviceId,
        serviceName: i.service.name,
        categoryName: i.service.category?.name || '',
        price: i.price,
        quantity: i.quantity,
        estimatedTime: i.service.estimatedTime || 0,
        netProfit: i.netProfit ?? i.price * i.quantity,
        servicemanName: i.servicemanName ?? record.serviceman,
      }));
      setItems(initialItems);

      const total = record.items.reduce((s, i) => s + i.price * i.quantity, 0);
      form.setFieldsValue({ finalPrice: total });
    }
  }, [open, record, form]);

  const allServices = categories.flatMap(c => c.services.map(s => ({ ...s, category: c })));

  const handleServiceSelect = (serviceId: string) => {
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;
    const existing = items.find(i => i.serviceId === serviceId);
    let next: ItemRow[];
    if (existing) {
      next = items.map(i => i.serviceId === serviceId ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      next = [...items, {
        serviceId: service.id,
        serviceName: service.name,
        categoryName: service.category.name,
        price: service.standardPrice,
        quantity: 1,
        estimatedTime: service.estimatedTime,
        netProfit: service.standardPrice,
        servicemanName: record.serviceman,
      }];
    }
    setItems(next);
    form.setFieldValue('finalPrice', next.reduce((s, i) => s + i.price * i.quantity, 0));
  };

  const removeItem = (serviceId: string) => {
    const next = items.filter(i => i.serviceId !== serviceId);
    setItems(next);
    form.setFieldValue('finalPrice', next.reduce((s, i) => s + i.price * i.quantity, 0));
  };

  const updateItemPrice = (serviceId: string, price: number) => {
    const next = items.map(i => i.serviceId === serviceId ? { ...i, price } : i);
    setItems(next);
    form.setFieldValue('finalPrice', next.reduce((s, i) => s + i.price * i.quantity, 0));
  };

  const updateItemQty = (serviceId: string, quantity: number) => {
    const next = items.map(i => i.serviceId === serviceId ? { ...i, quantity } : i);
    setItems(next);
    form.setFieldValue('finalPrice', next.reduce((s, i) => s + i.price * i.quantity, 0));
  };

  const updateItemNetProfit = (serviceId: string, netProfit: number) => {
    setItems(items.map(i => i.serviceId === serviceId ? { ...i, netProfit } : i));
  };

  const updateItemServiceman = (serviceId: string, servicemanName: string) => {
    setItems(items.map(i => i.serviceId === serviceId ? { ...i, servicemanName } : i));
  };

  const serviceOptions = categories.map(cat => ({
    label: cat.name,
    options: cat.services.map(s => ({ value: s.id, label: `${s.name} — ${formatPrice(s.standardPrice)}` })),
  }));

  const hasEmployees = employees.length > 0;

  const itemColumns = [
    {
      title: 'Услуга',
      dataIndex: 'serviceName',
      key: 'name',
      render: (name: string, row: ItemRow) => (
        <div>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{row.categoryName}</div>
        </div>
      ),
    },
    {
      title: 'Кол-во',
      key: 'quantity',
      width: 80,
      render: (_: unknown, row: ItemRow) => (
        <InputNumber
          min={1} max={99} value={row.quantity} size="small" controls style={{ width: 64 }}
          onChange={v => updateItemQty(row.serviceId, v || 1)}
        />
      ),
    },
    {
      title: 'Цена, р.',
      key: 'price',
      width: 110,
      render: (_: unknown, row: ItemRow) => (
        <InputNumber
          min={0} value={row.price} size="small" style={{ width: '100%' }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          onChange={v => updateItemPrice(row.serviceId, v || 0)}
        />
      ),
    },
    {
      title: 'Итого',
      key: 'total',
      width: 90,
      render: (_: unknown, row: ItemRow) => (
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: 'Прибыль, р.',
      key: 'netProfit',
      width: 120,
      render: (_: unknown, row: ItemRow) => (
        <InputNumber
          min={0} value={row.netProfit} size="small" style={{ width: '100%' }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          onChange={v => updateItemNetProfit(row.serviceId, v ?? 0)}
        />
      ),
    },
    ...(hasEmployees ? [{
      title: 'Сотрудник',
      key: 'serviceman',
      width: 140,
      render: (_: unknown, row: ItemRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.servicemanName}
          onChange={(v: string) => updateItemServiceman(row.serviceId, v)}
          options={employees.map(e => ({ value: e.name, label: e.name }))}
        />
      ),
    }] : []),
    {
      title: '',
      key: 'del',
      width: 36,
      render: (_: unknown, row: ItemRow) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeItem(row.serviceId)} />
      ),
    },
  ];

  const handleClose = async (withPrint = false) => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setLoading(true);
    try {
      await recordsApi.update(record.id, {
        items: items.map(i => ({
          serviceId: i.serviceId,
          price: i.price,
          quantity: i.quantity,
          netProfit: i.netProfit,
          servicemanName: i.servicemanName,
        })),
      });

      const closed = await recordsApi.close(record.id, {
        finalPrice: items.reduce((s, i) => s + i.price * i.quantity, 0),
        defects: values.defects || undefined,
        warranty: values.warranty || undefined,
        equipmentIds: values.equipmentIds || [],
        isPaidByBankTransfer: values.isPaidByBankTransfer || false,
      });

      if (withPrint) {
        const [settings, templates] = await Promise.all([
          servicesApi.getSettings().catch(() => undefined),
          servicesApi.getDocTemplates().catch(() => []),
        ]);
        const actTemplate = (templates as DocumentTemplate[]).find(t => t.type === 'completion_act' && t.isDefault)
          || (templates as DocumentTemplate[]).find(t => t.type === 'completion_act');
        printCompletionAct(closed, settings, actTemplate?.content);
      }

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

  return (
    <>
      {celebrating && <DealCelebration onDone={() => setCelebrating(false)} />}
      <Modal
        open={open}
        onCancel={onClose}
        title="Закрыть сделку"
        width={hasEmployees ? 920 : 720}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" style={{ fontSize: 13 }}>Перечень работ</Divider>

          <Select
            showSearch
            style={{ width: '100%', marginBottom: 12 }}
            value={undefined}
            onChange={handleServiceSelect}
            placeholder="Добавить услугу..."
            optionFilterProp="label"
            options={serviceOptions}
          />

          {items.length === 0 ? (
            <Empty description="Нет услуг" style={{ margin: '16px 0' }} />
          ) : (
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="serviceId"
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

          <Divider orientation="left" style={{ fontSize: 13 }}>Гарантия и оборудование</Divider>

          <Form.Item label="Гарантия на работу" name="warranty">
            <Input placeholder="Например: 1 год" />
          </Form.Item>

          <Form.Item label="Установленное оборудование (модули)" name="equipmentIds">
            <Select
              mode="multiple"
              placeholder="Выберите из списка"
              optionFilterProp="label"
              options={equipment.map(e => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>

          <Form.Item name="isPaidByBankTransfer" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Оплата по расчётному счёту (РС)</Checkbox>
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={onClose}>Отмена</Button>
            <Button
              icon={<PrinterOutlined />}
              loading={loading}
              onClick={() => handleClose(true)}
            >
              Завершить и распечатать акт
            </Button>
            <Button type="primary" loading={loading} onClick={() => handleClose(false)}>
              Завершить сделку
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};
