import React, { useEffect, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { CapitalTransaction } from '@/types';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { parseAmount } from '../../utils';
import shared from '../../shared.module.scss';

/** Валюта операции — по заполненному полю суммы */
const currencyOf = (tx: CapitalTransaction) =>
  tx.amountUsd != null ? 'USD' : tx.amountEur != null ? 'EUR' : 'BYN';

const formValues = (tx: CapitalTransaction) => ({
  date: dayjs(tx.date),
  amount: tx.amountUsd ?? tx.amountEur ?? tx.amountByn,
  description: tx.description || '',
  person: tx.person || undefined,
});

interface Props {
  /** Редактируемая операция; null — модалка закрыта */
  tx: CapitalTransaction | null;
  onClose: () => void;
}

/** Правка операции капитала (только Создатель). Меняется только капитал — касса и долги остаются как были. */
export const CapitalEditModal: React.FC<Props> = ({ tx, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const { directorServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tx) form.setFieldsValue(formValues(tx));
  }, [tx, form]);

  const isWithdrawal = tx?.type === 'WITHDRAWAL';

  const handleSubmit = async () => {
    if (!tx) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.updateCapitalTransaction(tx.id, {
        date: values.date.toISOString(),
        amount: values.amount,
        description: values.description?.trim() || null,
        ...(isWithdrawal && { person: values.person }),
      });
      invalidate('capital');
      notify.toast.success('Операция обновлена');
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось обновить операцию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isWithdrawal ? 'Изменить списание' : 'Изменить пополнение'}
      open={!!tx}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Сохранить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      {tx && (
        <Form form={form} layout="vertical" className={shared.form} initialValues={formValues(tx)}>
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker className={shared.fullWidth} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label={`Сумма (${currencyOf(tx)})`} name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0.01} className={shared.fullWidth} precision={2} parser={parseAmount} />
          </Form.Item>
          <Form.Item label={isWithdrawal ? 'Цель списания' : 'Откуда'} name="description">
            <Input />
          </Form.Item>
          {isWithdrawal && (
            <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
              <Select showSearch placeholder="Выберите сотрудника" options={personOptions(directorServicemen)} />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
};
