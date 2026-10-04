import React, { useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { CashTransaction } from '@/types';
import { ExpenseCategoryInput } from '@/components/ExpenseCategoryInput';
import { canHaveExpenseCategory } from '@/utils/expenses';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { founderDescriptionRule, isLinkedSalaryDescription, parseAmount } from '../../utils';
import shared from '../../shared.module.scss';

interface Props {
  /** Редактируемая проводка; null — модалка закрыта */
  tx: CashTransaction | null;
  onClose: () => void;
}

/** Правка проводки кассы. Расходы ЗП (учредителя/сотрудника) связаны с выплатами — их описание не меняется. */
export const EditTransactionModal: React.FC<Props> = ({ tx, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const { managerServicemen } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!tx) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const withCategory = canHaveExpenseCategory(tx);
      await accountingApi.updateCashTransaction(tx.id, {
        date: values.date.toISOString(),
        amount: values.amount,
        description: values.description || undefined,
        person: values.person || undefined,
        // Пустое поле — убрать категорию; у системных расходов поля нет
        ...(withCategory && { expenseCategory: values.expenseCategory?.trim() || null }),
      });
      // Проводка могла быть выплатой ЗП учредителю или сотруднику
      invalidate('cash', 'founderSalaries', 'salary');
      if (withCategory) invalidateReference('expenseCategories');
      notify.toast.success('Запись обновлена');
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось обновить запись');
    } finally {
      setSaving(false);
    }
  };

  const linked = !!tx && isLinkedSalaryDescription(tx.description);

  return (
    <Modal
      title="Редактировать запись"
      open={!!tx}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Сохранить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      {tx && (
        <Form
          form={form}
          layout="vertical"
          className={shared.form}
          initialValues={{
            date: dayjs(tx.date),
            amount: tx.amount,
            description: tx.description || '',
            person: tx.person || '',
            expenseCategory: tx.expenseCategory?.name || '',
          }}
        >
          <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
            <DatePicker className={shared.fullWidth} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
            <InputNumber min={0} className={shared.fullWidth} precision={2} parser={parseAmount} />
          </Form.Item>
          {(tx.type === 'EXPENSE' || tx.type === 'MANUAL_INCOME') && (
            <Form.Item
              label={tx.type === 'EXPENSE' ? 'Цель изъятия' : 'Источник'}
              name="description"
              rules={linked ? [] : [founderDescriptionRule]}
            >
              <Input readOnly={linked} />
            </Form.Item>
          )}
          {canHaveExpenseCategory(tx) && (
            <Form.Item label="Категория" name="expenseCategory" rules={[{ required: true, whitespace: true, message: 'Укажите категорию' }]}>
              <ExpenseCategoryInput />
            </Form.Item>
          )}
          {tx.type === 'EXPENSE' && (
            <Form.Item label="Изыматель" name="person">
              <Select showSearch placeholder="Выберите сотрудника" options={personOptions(managerServicemen)} />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
};
