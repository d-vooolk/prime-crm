import React, { useState, useEffect } from 'react';
import {
  Modal, Form, InputNumber, Input, Select, Button, Divider, message,
  Table, Empty, Checkbox,
} from 'antd';
import { Record, Equipment, DocumentTemplate, Serviceman } from '@/types';
import { servicesApi } from '@/api/services.api';
import { recordsApi } from '@/api/records.api';
import { formatPrice } from '@/utils/formatters';
import { printCompletionAct } from '@/utils/print';
import { DealCelebration } from '../DealCelebration';
import styles from './CloseRecordModal.module.scss';

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

const WARRANTY_OPTIONS = [
  { value: 'Без гарантии', label: 'Без гарантии' },
  { value: '1 месяц', label: '1 месяц' },
  { value: '6 месяцев', label: '6 месяцев' },
  { value: '1 год', label: '1 год' },
];

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [employees, setEmployees] = useState<Serviceman[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      servicesApi.getEquipment().then(setEquipment).catch(() => {});
      servicesApi.getAllServicemen().then(all =>
        setEmployees(all.filter(s => s.role === 'Сотрудник' && !s.isDismissed))
      ).catch(() => {});

      setItems(record.items.map(i => ({
        serviceId: i.serviceId,
        serviceName: i.service.name,
        categoryName: i.service.category?.name || '',
        price: i.price,
        quantity: i.quantity,
        estimatedTime: i.service.estimatedTime || 0,
        netProfit: i.netProfit ?? i.price * i.quantity,
        servicemanName: i.servicemanName ?? record.serviceman,
      })));

      form.resetFields();
    }
  }, [open, record, form]);

  const updateItemNetProfit = (serviceId: string, netProfit: number) => {
    setItems(prev => prev.map(i => i.serviceId === serviceId ? { ...i, netProfit } : i));
  };

  const updateItemServiceman = (serviceId: string, servicemanName: string) => {
    setItems(prev => prev.map(i => i.serviceId === serviceId ? { ...i, servicemanName } : i));
  };

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
      title: 'Сумма',
      key: 'total',
      width: 100,
      render: (_: unknown, row: ItemRow) => (
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPrice(row.price * row.quantity)}</span>
      ),
    },
    {
      title: 'Чистая прибыль, р.',
      key: 'netProfit',
      width: 120,
      render: (_: unknown, row: ItemRow) => (
        <InputNumber
          min={0}
          value={row.netProfit}
          size="small"
          style={{ width: '100%' }}
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
  ];

  const handleClose = async () => {
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

      await recordsApi.close(record.id, {
        finalPrice: items.reduce((s, i) => s + i.price * i.quantity, 0),
        defects: values.defects || undefined,
        warranty: values.warranty || undefined,
        equipmentIds: values.equipmentId ? [values.equipmentId] : [],
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

  return (
    <>
      {celebrating && <DealCelebration onDone={() => setCelebrating(false)} />}
      <Modal
        open={open}
        onCancel={onClose}
        title="Закрыть сделку"
        width={hasEmployees ? 860 : 680}
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
            <Select
              placeholder="Выберите срок гарантии"
              allowClear
              options={WARRANTY_OPTIONS}
            />
          </Form.Item>

          <Form.Item label="Установленное оборудование (модули)" name="equipmentId">
            <Select
              placeholder="Выберите из списка"
              allowClear
              optionFilterProp="label"
              options={equipment.map(e => ({ value: e.id, label: e.name }))}
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
