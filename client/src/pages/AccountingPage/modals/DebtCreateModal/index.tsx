import React, { useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { accountingApi } from '@/api/accounting.api';
import { Currency } from '@/types';
import { ExpenseCategoryInput } from '@/components/ExpenseCategoryInput';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { CAPITAL_CURRENCY_OPTIONS } from '../../utils';
import shared from '../../shared.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Values {
  description: string;
  amount: number;
  currency: Currency;
  companyOwes: boolean;
  expenseCategory?: string;
}

export const DebtCreateModal: React.FC<Props> = ({ open, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);

  const close = () => {
    form.resetFields();
    onClose();
  };

  const handleFinish = async (vals: Values) => {
    setSaving(true);
    try {
      await accountingApi.createDebt({
        description: vals.description.trim(),
        amount: vals.amount,
        currency: vals.currency,
        direction: vals.companyOwes ? 'WE_OWE' : 'OWED_TO_US',
        ...(vals.companyOwes && { expenseCategory: vals.expenseCategory?.trim() }),
      });
      notify.toast.success('Долг добавлен');
      if (vals.companyOwes) invalidateReference('expenseCategories');
      close();
      await invalidate('debts');
    } catch (e) {
      notify.error(e, 'Не удалось добавить долг');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Добавить долг"
      open={open}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Добавить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className={shared.form}
        initialValues={{ companyOwes: true, currency: 'BYN' }}
        onFinish={handleFinish}
      >
        <Form.Item label="За что" name="description" rules={[{ required: true, message: 'Укажите, за что долг' }]}>
          <Input placeholder="Например: запчасти у поставщика" />
        </Form.Item>
        <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
          <InputNumber min={0.01} precision={2} className={shared.fullWidth} />
        </Form.Item>
        <Form.Item label="Валюта долга" name="currency">
          <Select options={CAPITAL_CURRENCY_OPTIONS} />
        </Form.Item>
        <Form.Item label="Тип" name="companyOwes" valuePropName="checked">
          <Switch checkedChildren="Мы должны" unCheckedChildren="Нам должны" />
        </Form.Item>
        {/* Погашения нашего долга уходят в расходы — по категории они попадут в нужную статью аналитики */}
        <Form.Item noStyle dependencies={['companyOwes']}>
          {({ getFieldValue }) => getFieldValue('companyOwes') && (
            <Form.Item
              label="Категория"
              name="expenseCategory"
              rules={[{ required: true, whitespace: true, message: 'Укажите категорию' }]}
            >
              <ExpenseCategoryInput />
            </Form.Item>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};
