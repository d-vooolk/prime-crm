import React, { useEffect, useRef, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { CAPITAL_CURRENCY_OPTIONS, parseAmount } from '../../utils';
import shared from '../../shared.module.scss';

export type CapitalOperation = 'deposit' | 'withdrawal';

interface Props {
  /** Какая операция открыта; null — модалка закрыта */
  kind: CapitalOperation | null;
  onClose: () => void;
}

/** Внести в капитал или списать из него. Списывать могут только директор и выше. */
export const CapitalOperationModal: React.FC<Props> = ({ kind, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const { defaultDirectorPerson, directorServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  // Пока модалка закрывается (kind уже null), показываем прежнюю операцию — без скачка заголовка и полей
  const lastKind = useRef<CapitalOperation>('deposit');
  if (kind) lastKind.current = kind;
  const isWithdrawal = (kind ?? lastKind.current) === 'withdrawal';

  useEffect(() => {
    if (kind === 'deposit') form.setFieldsValue({ date: dayjs(), currency: 'BYN' });
    if (kind === 'withdrawal') form.setFieldsValue({ date: dayjs(), currency: 'BYN', person: defaultDirectorPerson });
  }, [kind, defaultDirectorPerson, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (isWithdrawal) {
        await accountingApi.createWithdrawal({
          date: values.date.toISOString(),
          amount: values.amount,
          currency: values.currency,
          description: values.description,
          person: values.person,
        });
        notify.toast.success('Списание добавлено');
      } else {
        await accountingApi.createDeposit({
          date: values.date.toISOString(),
          amount: values.amount,
          currency: values.currency,
        });
        notify.toast.success('Пополнение добавлено');
      }
      invalidate('capital');
      form.resetFields();
      onClose();
    } catch (e) {
      notify.error(e, isWithdrawal ? 'Не удалось списать' : 'Не удалось внести');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isWithdrawal ? 'Списать из капитала' : 'Внести в капитал'}
      open={!!kind}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isWithdrawal ? 'Списать' : 'Внести'}
      okButtonProps={{ loading: saving, danger: isWithdrawal }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className={shared.form}>
        <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
          <DatePicker className={shared.fullWidth} format="DD.MM.YYYY" />
        </Form.Item>
        <Form.Item label="Сумма" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
          <InputNumber min={0} className={shared.fullWidth} precision={2} parser={parseAmount} />
        </Form.Item>
        <Form.Item label="Валюта" name="currency" rules={[{ required: true }]}>
          <Select options={CAPITAL_CURRENCY_OPTIONS} />
        </Form.Item>
        {isWithdrawal && (
          <>
            <Form.Item label="Цель списания" name="description">
              <Input placeholder="Например: дивиденды, личные нужды" />
            </Form.Item>
            <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
              <Select showSearch placeholder="Выберите сотрудника" options={personOptions(directorServicemen)} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
