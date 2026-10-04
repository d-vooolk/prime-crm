import React, { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { ExpenseCategoryInput } from '@/components/ExpenseCategoryInput';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateReference } from '@/hooks/useReferenceData';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { FOUNDER_SALARY_PREFIX, founderDescriptionRule, parseAmount } from '../../utils';
import shared from '../../shared.module.scss';
import styles from './ExpenseModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  /** «Отчисление в капитал» — отдельная модалка, открывается вместо этой */
  onCapitalTransfer: () => void;
}

/** Изъять средства из кассы: обычный расход с категорией или ЗП учредителя (свитч) */
export const ExpenseModal: React.FC<Props> = ({ open, onClose, onCapitalTransfer }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const invalidateReference = useInvalidateReference();
  const { defaultPerson, managerServicemen, directorUser, creatorUser } = usePersons();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [isFounderSalary, setIsFounderSalary] = useState(false);
  const [founderPerson, setFounderPerson] = useState('');

  const founderOptions = personOptions([directorUser, creatorUser].filter((s): s is NonNullable<typeof s> => !!s));

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ person: defaultPerson, date: dayjs() });
    setIsFounderSalary(false);
    setFounderPerson('');
  }, [open, defaultPerson, form]);

  const handleFounderPersonChange = (name: string) => {
    setFounderPerson(name);
    form.setFieldsValue({ description: `${FOUNDER_SALARY_PREFIX} ${name}` });
  };

  const handleFounderToggle = (next: boolean) => {
    setIsFounderSalary(next);
    setFounderPerson('');
    if (!next) form.setFieldsValue({ description: '', founderMonth: null });
    else form.setFieldsValue({ founderMonth: dayjs(), description: '' });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (isFounderSalary && !founderPerson) {
      notify.toast.error('Выберите учредителя');
      return;
    }
    setSaving(true);
    try {
      const founderMonth = values.founderMonth as Dayjs | undefined;
      await accountingApi.createExpense({
        date: values.date.toISOString(),
        description: values.description,
        amount: values.amount,
        person: values.person,
        founderSalary: isFounderSalary && founderMonth
          ? { year: founderMonth.year(), month: founderMonth.month() + 1, person: founderPerson }
          : undefined,
        // ЗП учредителя — системный расход, без категории
        expenseCategory: isFounderSalary ? undefined : values.expenseCategory?.trim() || undefined,
      });
      invalidate('cash', ...(isFounderSalary ? ['founderSalaries' as const] : []));
      // Новая категория создаётся на сервере по введённому названию
      if (!isFounderSalary) invalidateReference('expenseCategories');
      notify.toast.success('Расход добавлен');
      form.resetFields();
      setIsFounderSalary(false);
      setFounderPerson('');
      onClose();
    } catch (e) {
      notify.error(e, 'Не удалось добавить расход');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Изъять средства"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Добавить"
      okButtonProps={{ loading: saving, danger: true }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <div className={styles.capitalTransferEntry}>
        <Button icon={<BankOutlined />} onClick={onCapitalTransfer}>
          Отчисление в капитал
        </Button>
        <span>Перевести наличные из кассы в капитал — в BYN или с обменом на валюту</span>
      </div>
      <Form form={form} layout="vertical" className={shared.form}>
        <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
          <DatePicker className={shared.fullWidth} format="DD.MM.YYYY" />
        </Form.Item>
        {isFounderSalary && (
          <Form.Item label="Месяц ЗП" name="founderMonth" rules={[{ required: true, message: 'Выберите месяц' }]}>
            <DatePicker picker="month" className={shared.fullWidth} format="MM.YYYY" allowClear={false} />
          </Form.Item>
        )}
        {isFounderSalary && (
          <Form.Item label="Получатель" rules={[{ required: true }]}>
            <Select
              placeholder="Выберите учредителя"
              value={founderPerson || undefined}
              onChange={handleFounderPersonChange}
              options={founderOptions}
            />
          </Form.Item>
        )}
        <Form.Item
          label="Цель изъятия"
          name="description"
          rules={[{ required: true, message: 'Укажите цель' }, ...(isFounderSalary ? [] : [founderDescriptionRule])]}
        >
          <Input placeholder={isFounderSalary ? '' : 'Например: закупка расходников'} readOnly={isFounderSalary} />
        </Form.Item>
        {!isFounderSalary && (
          <Form.Item label="Категория" name="expenseCategory" rules={[{ required: true, whitespace: true, message: 'Укажите категорию' }]}>
            <ExpenseCategoryInput />
          </Form.Item>
        )}
        <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
          <InputNumber min={0} className={shared.fullWidth} precision={2} parser={parseAmount} />
        </Form.Item>
        <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
          <Select showSearch placeholder="Выберите сотрудника" options={personOptions(managerServicemen)} />
        </Form.Item>
        <Form.Item className={styles.founderSwitchItem}>
          <div className={styles.founderSwitch}>
            <Switch checked={isFounderSalary} onChange={handleFounderToggle} />
            <span>ЗП учредителей</span>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
