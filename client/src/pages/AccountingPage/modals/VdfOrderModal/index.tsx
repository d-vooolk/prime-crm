import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Modal, Select } from 'antd';
import { vdfOrdersApi, VdfOrder } from '@/api/accounting.api';
import { formatMoney } from '@/utils/formatters';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { parseAmount } from '../../utils';
import shared from '../../shared.module.scss';
import styles from './VdfOrderModal.module.scss';

export type VdfOrderModalMode = 'amount' | 'execute';

interface Props {
  order: VdfOrder | null;
  mode: VdfOrderModalMode;
  onClose: () => void;
}

/**
 * Заказ сотрудника из vdf.by: правка суммы или исполнение.
 * Исполнение создаёт в кассе расход сегодняшним днём с категорией «vdf.by».
 */
export const VdfOrderModal: React.FC<Props> = ({ order, mode, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const { defaultPerson, managerServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const executing = mode === 'execute';

  useEffect(() => {
    if (order) form.setFieldsValue({ amount: order.amount, person: defaultPerson });
  }, [order, defaultPerson, form]);

  if (!order) return null;

  const submit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (executing) {
        await vdfOrdersApi.execute(order.id, values.person);
        notify.toast.success('Заказ исполнен, расход добавлен в кассу');
        invalidate('vdfOrders', 'cash');
        // Категория «vdf.by» создаётся на сервере, если её ещё нет
        invalidateReference('expenseCategories');
      } else {
        await vdfOrdersApi.updateAmount(order.id, values.amount);
        notify.toast.success('Сумма изменена');
        invalidate('vdfOrders');
      }
      onClose();
    } catch (e) {
      notify.error(e, executing ? 'Не удалось исполнить заказ' : 'Не удалось изменить сумму');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${executing ? 'Исполнить' : 'Сумма'} — заказ №${order.shopOrderId}`}
      open
      onCancel={onClose}
      onOk={submit}
      okText={executing ? 'Исполнить' : 'Сохранить'}
      okButtonProps={{ loading: saving, danger: executing }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <div className={styles.summary}>
        {order.employeeName} · в магазине {formatMoney(order.shopTotal)}
        {executing && (
          <div>В кассе появится расход {formatMoney(order.amount)} сегодняшним днём, категория «vdf.by».</div>
        )}
      </div>
      <Form form={form} layout="vertical" className={shared.form}>
        {executing ? (
          <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
            <Select showSearch placeholder="Выберите сотрудника" options={personOptions(managerServicemen)} />
          </Form.Item>
        ) : (
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0.01} className={shared.fullWidth} precision={2} parser={parseAmount} autoFocus />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
