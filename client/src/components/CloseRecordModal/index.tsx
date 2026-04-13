import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Input, Select, Button, Divider, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { Record, Equipment } from '@/types';
import { servicesApi } from '@/api/services.api';
import { recordsApi } from '@/api/records.api';
import { formatPrice } from '@/utils/formatters';
import { printCompletionAct } from '@/utils/print';

interface Props {
  record: Record;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const totalFromServices = record.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      servicesApi.getEquipment().then(setEquipment).catch(() => {});
      form.setFieldsValue({ finalPrice: totalFromServices });
    }
  }, [open, totalFromServices, form]);

  const handleClose = async (withPrint = false) => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setLoading(true);
    try {
      const closed = await recordsApi.close(record.id, {
        finalPrice: values.finalPrice,
        priceIncreaseReason: values.priceIncreaseReason,
        warranty: values.warranty,
        equipmentIds: values.equipmentIds || [],
      });

      if (withPrint) {
        printCompletionAct(closed);
      }

      message.success('Сделка завершена');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Закрыть сделку"
      width={600}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left" style={{ fontSize: 13 }}>Финансы</Divider>

        <Form.Item
          label="Итоговая сумма"
          name="finalPrice"
          rules={[{ required: true, message: 'Укажите сумму' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            addonAfter="₽"
            size="large"
          />
        </Form.Item>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: -12, marginBottom: 16 }}>
          Сумма по услугам: {formatPrice(totalFromServices)}
        </p>

        <Form.Item label="Причина изменения стоимости (если есть)" name="priceIncreaseReason">
          <Input.TextArea rows={2} placeholder="Например: обнаружена дополнительная неисправность" />
        </Form.Item>

        <Divider orientation="left" style={{ fontSize: 13 }}>Гарантия и оборудование</Divider>

        <Form.Item label="Гарантия на работу" name="warranty">
          <Input placeholder="Например: 1 год" />
        </Form.Item>

        <Form.Item label="Установленное оборудование" name="equipmentIds">
          <Select
            mode="multiple"
            placeholder="Выберите из списка"
            optionFilterProp="label"
            options={equipment.map(e => ({ value: e.id, label: e.name }))}
          />
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
  );
};
