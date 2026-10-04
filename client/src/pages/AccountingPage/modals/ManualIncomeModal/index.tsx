import React, { useEffect, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { parseAmount } from '../../utils';
import shared from '../../shared.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Ввод средств в кассу вручную (не от клиента) */
export const ManualIncomeModal: React.FC<Props> = ({ open, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const { defaultPerson, managerServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.setFieldsValue({ person: defaultPerson, date: dayjs() });
  }, [open, defaultPerson, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createManualIncome({
        date: values.date.toISOString(),
        description: values.description,
        amount: values.amount,
        person: values.person,
      });
      invalidate('cash');
      notify.toast.success('Приход добавлен');
      form.resetFields();
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось добавить приход');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ввод средств"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Добавить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className={shared.form}>
        <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
          <DatePicker className={shared.fullWidth} format="DD.MM.YYYY" />
        </Form.Item>
        <Form.Item label="Источник" name="description" rules={[{ required: true, message: 'Укажите источник' }]}>
          <Input placeholder="Например: перевод от учредителя" />
        </Form.Item>
        <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
          <InputNumber min={0} className={shared.fullWidth} precision={2} parser={parseAmount} />
        </Form.Item>
        <Form.Item label="Дебетор" name="person" rules={[{ required: true, message: 'Выберите дебетора' }]}>
          <Select showSearch placeholder="Выберите сотрудника" options={personOptions(managerServicemen)} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
