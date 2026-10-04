import React, { useState } from 'react';
import { Form, Input, InputNumber, Modal } from 'antd';
import { accountingApi, Debt } from '@/api/accounting.api';
import { ExpenseCategoryInput } from '@/components/ExpenseCategoryInput';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import shared from '../../shared.module.scss';

interface Props {
  /** Редактируемый долг; null — модалка закрыта */
  debt: Debt | null;
  onClose: () => void;
}

interface Values {
  description: string;
  amount?: number;
  expenseCategory?: string;
}

/** Правка долга: сумму можно менять, только пока по нему нет погашений */
export const DebtEditModal: React.FC<Props> = ({ debt, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  const hasPayments = !!debt && debt.payments.length > 0;

  const handleFinish = async (vals: Values) => {
    if (!debt) return;
    setSaving(true);
    try {
      const payload: { description?: string; amount?: number; expenseCategory?: string } = { description: vals.description };
      if (debt.direction === 'WE_OWE') payload.expenseCategory = vals.expenseCategory?.trim();
      if (!hasPayments && vals.amount !== undefined) payload.amount = Math.round(vals.amount);
      await accountingApi.updateDebt(debt.id, payload);
      notify.toast.success('Долг обновлён');
      if (debt.direction === 'WE_OWE') invalidateReference('expenseCategories');
      onClose();
      await invalidate('debts');
    } catch (e) {
      notify.error(e, 'Не удалось обновить долг');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Редактировать долг"
      open={!!debt}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Сохранить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      {debt && (
        <Form
          form={form}
          layout="vertical"
          className={shared.form}
          onFinish={handleFinish}
          initialValues={{
            description: debt.description,
            amount: debt.initialAmount,
            expenseCategory: debt.expenseCategory?.name ?? '',
          }}
        >
          <Form.Item label="За что" name="description" rules={[{ required: true, message: 'Укажите, за что долг' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label={`Сумма (${debt.currency ?? 'BYN'})`}
            name="amount"
            rules={[{ required: true, message: 'Укажите сумму' }]}
            extra={hasPayments ? 'По долгу уже есть погашения — сумму изменить нельзя' : undefined}
          >
            <InputNumber min={0.01} precision={2} className={shared.fullWidth} disabled={hasPayments} />
          </Form.Item>
          {debt.direction === 'WE_OWE' && (
            <Form.Item
              label="Категория"
              name="expenseCategory"
              rules={[{ required: true, whitespace: true, message: 'Укажите категорию' }]}
            >
              <ExpenseCategoryInput />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
};
