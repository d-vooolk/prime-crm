import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, Form, InputNumber, Modal, Select, Switch } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { accountingApi, SalaryData } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { roundSalaryAmount, SALARY_ROUND_STEP } from '@/utils/salary';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { personOptions, usePersons } from '../../hooks/usePersons';
import { cashAfterCardChange, parseAmount } from '../../utils';
import styles from './SalaryPayModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  employee: string;
  month: Dayjs;
  salaryData: SalaryData | null;
  periodLabel: string;
}

/**
 * Выплата ЗП сотруднику: наличными из кассы (расход) и/или на карту.
 * Меньше остатка — аванс, иначе расчёт за период.
 */
export const SalaryPayModal: React.FC<Props> = ({ open, onClose, employee, month, salaryData, periodLabel }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const { defaultPerson, managerServicemen } = usePersons();
  const [form] = Form.useForm();
  const amount = Form.useWatch('amount', form) as number | undefined;
  const cardAmount = Form.useWatch('cardAmount', form) as number | undefined;
  const [toCard, setToCard] = useState(false);
  const [saving, setSaving] = useState(false);
  // Предыдущая сумма на карту: изменение карты переносится из наличных, общая сумма сохраняется
  const prevCardRef = useRef(0);

  const remaining = salaryData?.remaining ?? 0;

  // По умолчанию предлагаем весь остаток за период. Только при открытии:
  // перезапрос расчёта или сотрудников не должен сбрасывать введённое
  useEffect(() => {
    if (!open) return;
    setToCard(false);
    prevCardRef.current = 0;
    form.setFieldsValue({
      amount: Math.max(0, salaryData?.remaining ?? 0),
      date: dayjs(),
      person: defaultPerson || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // При включённой карте поле amount — это наличные (в кассу), выплата целиком = наличные + карта
  const cash = amount ?? 0;
  const card = toCard ? cardAmount ?? 0 : 0;
  const total = cash + card;

  const handleToCardChange = (checked: boolean) => {
    if (!checked) {
      // Карту выключили — её сумма возвращается в наличные
      form.setFieldsValue({ amount: cash + (form.getFieldValue('cardAmount') ?? 0), cardAmount: undefined });
    }
    prevCardRef.current = 0;
    setToCard(checked);
  };

  const handleValuesChange = (changed: { cardAmount?: number | null }) => {
    if (!('cardAmount' in changed)) return;
    const next = changed.cardAmount ?? 0;
    form.setFieldsValue({ amount: cashAfterCardChange(form.getFieldValue('amount') ?? 0, prevCardRef.current, next) });
    prevCardRef.current = next;
  };

  const handleRound = (direction: 'up' | 'down') => {
    form.setFieldsValue({ amount: roundSalaryAmount(form.getFieldValue('amount') ?? 0, direction) });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (total <= 0) { notify.toast.error('Сумма должна быть больше нуля'); return; }
    setSaving(true);
    try {
      await accountingApi.createSalaryPayment({
        servicemanName: employee,
        year: month.year(),
        month: month.month() + 1,
        amount: total,
        cardAmount: card,
        date: values.date.toISOString(),
        person: cash > 0 ? values.person : undefined,
      });
      notify.toast.success(cash > 0 ? 'Выплата записана, наличные — в кассу' : 'Выплата на карту записана');
      form.resetFields();
      onClose();
      invalidate('salary', 'cash');
    } catch (e) {
      notify.error(e, 'Не удалось записать выплату');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Выплатить ЗП — ${employee}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Выплатить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
    >
      {salaryData && (
        <div className={styles.payInfo}>
          <div>Период: <strong>{periodLabel}</strong></div>
          <div>Начислено: <strong>{formatPrice(salaryData.adjustedTotal)}</strong></div>
          {salaryData.paidTotal > 0 && (
            <div>Уже выплачено: <strong>{formatPrice(salaryData.paidTotal)}</strong></div>
          )}
          <div>
            {remaining < 0 ? 'Переплата: ' : 'Осталось к выплате: '}
            <strong className={remaining < 0 ? styles.overpaid : styles.remaining}>
              {formatPrice(Math.abs(remaining))}
            </strong>
          </div>
        </div>
      )}
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Form.Item
          label={toCard ? 'Наличными из кассы (р.)' : 'Сумма к выплате (р.)'}
          name="amount"
          rules={toCard
            ? [{ required: true, message: 'Укажите сумму' }]
            : [
              { required: true, message: 'Укажите сумму' },
              { type: 'number', min: 0.01, message: 'Сумма должна быть больше нуля' },
            ]}
          extra={total > 0
            ? (total < remaining
              ? `Будет записано как аванс, останется ${formatPrice(remaining - total)}`
              : 'Будет записано как расчёт за период')
            : undefined}
        >
          <InputNumber min={0} className={styles.fullWidth} precision={2} parser={parseAmount} />
        </Form.Item>
        <div className={styles.roundButtons}>
          <Button icon={<ArrowUpOutlined />} onClick={() => handleRound('up')}>Округлить вверх</Button>
          <Button icon={<ArrowDownOutlined />} onClick={() => handleRound('down')}>Округлить вниз</Button>
        </div>
        <div className={styles.roundHint}>Копейки округляются до целого, дальше каждое нажатие — ±{SALARY_ROUND_STEP} р.</div>
        <div className={styles.cardSwitch}>
          <Switch checked={toCard} onChange={handleToCardChange} />
          <span>Часть на карту</span>
        </div>
        {toCard && (
          <Form.Item
            label="Сумма на карту (р.)"
            name="cardAmount"
            rules={[{ required: true, message: 'Укажите сумму на карту' }]}
            extra={`Всего выплата: ${formatPrice(total)}`}
          >
            <InputNumber min={0} className={styles.fullWidth} precision={2} parser={parseAmount} />
          </Form.Item>
        )}
        <Form.Item label="Дата" name="date" rules={[{ required: true }]}>
          <DatePicker className={styles.fullWidth} format="DD.MM.YYYY" />
        </Form.Item>
        {cash > 0 && (
          <Form.Item label="Изыматель" name="person" rules={[{ required: true, message: 'Выберите изымателя' }]}>
            <Select showSearch placeholder="Кто выдаёт деньги из кассы" options={personOptions(managerServicemen)} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
