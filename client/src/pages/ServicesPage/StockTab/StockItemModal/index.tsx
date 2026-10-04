import React, { useEffect, useState } from 'react';
import { Col, Form, Input, InputNumber, Modal, Row } from 'antd';
import { stockApi, StockItemPayload } from '@/api/stock.api';
import { useNotify } from '@/hooks/useNotify';
import type { StockItem } from '@/types';
import styles from './StockItemModal.module.scss';

interface Props {
  open: boolean;
  /** Редактирование; без него — новый товар в категории categoryId */
  item?: StockItem | null;
  categoryId: string | null;
  categoryPath: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  name: string;
  sku?: string;
  unit: string;
  quantity?: number | null;
  minQuantity?: number | null;
  purchasePrice?: number | null;
  notes?: string;
}

/** Карточка товара. Остаток задаётся только при создании, дальше — движениями */
export const StockItemModal: React.FC<Props> = ({ open, item, categoryId, categoryPath, onClose, onSaved }) => {
  const [form] = Form.useForm<FormValues>();
  const notify = useNotify();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(item
      ? {
        name: item.name, sku: item.sku ?? '', unit: item.unit, minQuantity: item.minQuantity ?? null,
        purchasePrice: item.purchasePrice ?? null, notes: item.notes ?? '',
      }
      : { name: '', sku: '', unit: 'шт', quantity: 0, minQuantity: null, purchasePrice: null, notes: '' });
  }, [open, item, form]);

  const save = async () => {
    const v = await form.validateFields();
    const payload: StockItemPayload = {
      categoryId: item?.categoryId ?? categoryId!,
      name: v.name.trim(),
      sku: v.sku?.trim() || null,
      unit: v.unit.trim() || 'шт',
      minQuantity: v.minQuantity ?? null,
      purchasePrice: v.purchasePrice ?? null,
      notes: v.notes?.trim() || null,
    };
    setSaving(true);
    try {
      if (item) await stockApi.updateItem(item.id, payload);
      else await stockApi.createItem({ ...payload, quantity: v.quantity ?? 0 });
      onSaved();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось сохранить товар');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={item ? 'Товар' : 'Новый товар'}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      destroyOnHidden
    >
      <div className={styles.path}>{categoryPath}</div>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
          <Input autoFocus maxLength={200} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={16}>
            <Form.Item name="sku" label="Артикул">
              <Input maxLength={100} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="unit" label="Ед. изм." rules={[{ required: true, whitespace: true, message: 'Укажите' }]}>
              <Input maxLength={20} placeholder="шт, м, л" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          {!item && (
            <Col span={8}>
              <Form.Item name="quantity" label="Остаток">
                <InputNumber min={0} precision={3} className={styles.full} />
              </Form.Item>
            </Col>
          )}
          <Col span={item ? 12 : 8}>
            <Form.Item
              name="minQuantity"
              label="Напомнить при"
              tooltip="Когда остаток станет таким или меньше, товар попадёт в «Заканчивается» и появится напоминание"
            >
              <InputNumber min={0} precision={3} className={styles.full} placeholder="не напоминать" />
            </Form.Item>
          </Col>
          <Col span={item ? 12 : 8}>
            <Form.Item name="purchasePrice" label="Закупка, р.">
              <InputNumber min={0} precision={2} className={styles.full} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="Заметка">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} placeholder="Поставщик, где лежит и т.п." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
