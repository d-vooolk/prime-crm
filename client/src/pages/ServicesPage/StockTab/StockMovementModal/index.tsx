import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Segmented } from 'antd';
import { stockApi } from '@/api/stock.api';
import { useNotify } from '@/hooks/useNotify';
import type { StockItem, StockMovementType } from '@/types';
import { formatQty } from '../stock.utils';
import styles from './StockMovementModal.module.scss';

interface Props {
  item: StockItem | null;
  initialType?: StockMovementType;
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTIONS: Array<{ value: StockMovementType; label: string }> = [
  { value: 'IN', label: 'Приход' },
  { value: 'OUT', label: 'Расход' },
  { value: 'ADJUST', label: 'Инвентаризация' },
];

/** Приход, расход или инвентаризация (точный остаток) по товару */
export const StockMovementModal: React.FC<Props> = ({ item, initialType = 'IN', onClose, onSaved }) => {
  const [form] = Form.useForm<{ quantity: number | null; comment?: string }>();
  const notify = useNotify();
  const [type, setType] = useState<StockMovementType>(initialType);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setType(initialType);
    form.setFieldsValue({ quantity: null, comment: '' });
  }, [item, initialType, form]);

  const save = async () => {
    if (!item) return;
    const v = await form.validateFields();
    setSaving(true);
    try {
      await stockApi.move(item.id, { type, quantity: v.quantity ?? 0, comment: v.comment?.trim() || undefined });
      onSaved();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось изменить остаток');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={item?.name}
      open={!!item}
      onCancel={onClose}
      onOk={save}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      destroyOnHidden
    >
      {item && (
        <>
          <div className={styles.current}>
            Сейчас на складе: <strong>{formatQty(item.quantity)} {item.unit}</strong>
          </div>
          <Segmented block options={TYPE_OPTIONS} value={type} onChange={v => setType(v as StockMovementType)} className={styles.types} />
          <Form form={form} layout="vertical">
            <Form.Item
              name="quantity"
              label={type === 'ADJUST' ? `Фактический остаток, ${item.unit}` : `Количество, ${item.unit}`}
              rules={[
                { required: true, message: 'Укажите количество' },
                {
                  validator: (_, value: number | null) => (type !== 'ADJUST' && (value ?? 0) <= 0
                    ? Promise.reject(new Error('Количество должно быть больше нуля'))
                    : Promise.resolve()),
                },
              ]}
            >
              <InputNumber min={0} precision={3} autoFocus className={styles.full} />
            </Form.Item>
            <Form.Item name="comment" label="Комментарий">
              <Input maxLength={500} placeholder={type === 'OUT' ? 'Куда ушло: запись, брак…' : 'Поставщик, накладная…'} />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};
