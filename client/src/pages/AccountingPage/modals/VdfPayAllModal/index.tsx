import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Modal, Select } from 'antd';
import { vdfOrdersApi, VdfOrder } from '@/api/accounting.api';
import { formatMoney, plural } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { parseAmount, vdfBulkPreview, vdfUnpaidTotal } from '../../utils';
import shared from '../../shared.module.scss';
import styles from './VdfPayAllModal.module.scss';

interface Props {
  open: boolean;
  /** Ожидающие заказы в порядке списка — старые первыми */
  orders: VdfOrder[];
  onClose: () => void;
}

/**
 * Выплата одной суммой по всем ожидающим заказам vdf.by. На каждый заказ — свой расход в кассе
 * с категорией «vdf.by»; не хватило на последний — он оплачивается частично и остаётся с остатком.
 */
export const VdfPayAllModal: React.FC<Props> = ({ open, orders, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const { defaultPerson, managerServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const unpaid = vdfUnpaidTotal(orders);
  const amount: number | null = Form.useWatch('amount', form) ?? null;

  useEffect(() => {
    if (open) form.setFieldsValue({ amount: unpaid, person: defaultPerson });
  }, [open, unpaid, defaultPerson, form]);

  const preview = amount && amount > 0 && amount <= unpaid ? vdfBulkPreview(orders, amount) : null;

  const submit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const result = await vdfOrdersApi.payAll(values.person, values.amount);
      notify.toast.success(result.partial
        ? `Выплачено ${formatMoney(values.amount)}, один заказ оплачен частично`
        : `Выплачено ${formatMoney(values.amount)}, заказы исполнены`);
      invalidate('vdfOrders', 'cash');
      invalidateReference('expenseCategories');
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось выплатить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Выплатить по заказам vdf.by"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Выплатить"
      okButtonProps={{ loading: saving, danger: true, disabled: !preview }}
      cancelText="Закрыть"
      destroyOnHidden
    >
      <div className={styles.summary}>
        Не выплачено {formatMoney(unpaid)}. Заказы оплачиваются по порядку, старые первыми; на каждый в кассе
        появится расход сегодняшним днём с категорией «vdf.by».
      </div>
      <Form form={form} layout="vertical" className={shared.form}>
        <Form.Item
          label="Сумма выплаты (р.)"
          name="amount"
          rules={[
            { required: true, message: 'Укажите сумму' },
            {
              validator: (_, v?: number) => v == null || v <= unpaid
                ? Promise.resolve()
                : Promise.reject(new Error(`Не больше невыплаченного ${formatMoney(unpaid)}`)),
            },
          ]}
        >
          <InputNumber min={0.01} max={unpaid} className={shared.fullWidth} precision={2} parser={parseAmount} autoFocus />
        </Form.Item>
        <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
          <Select showSearch placeholder="Выберите сотрудника" options={personOptions(managerServicemen)} />
        </Form.Item>
      </Form>
      {preview && (
        <div className={styles.preview}>
          {preview.full.length > 0 && (
            <div>
              Исполнены полностью: {preview.full.length} {plural(preview.full.length, ['заказ', 'заказа', 'заказов'])}
              {' '}({preview.full.map(o => `№${o.shopOrderId}`).join(', ')})
            </div>
          )}
          {preview.partial && (
            <div>
              Заказ №{preview.partial.order.shopOrderId} ({preview.partial.order.employeeName}) — частично:
              {' '}оплачено {formatMoney(preview.partial.pay)}, останется {formatMoney(preview.partial.left)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
