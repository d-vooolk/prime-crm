import React, { useRef, useState } from 'react';
import { Form, Input, InputNumber, Modal } from 'antd';
import { Dayjs } from 'dayjs';
import { accountingApi } from '@/api/accounting.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import { parseAmount } from '../../utils';
import shared from '../../shared.module.scss';

export type AdjustmentType = 'FINE' | 'BONUS';

interface Props {
  /** Штраф или премия; null — модалка закрыта */
  type: AdjustmentType | null;
  onClose: () => void;
  employee: string;
  month: Dayjs;
}

export const AdjustmentModal: React.FC<Props> = ({ type, onClose, employee, month }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  // Пока модалка закрывается (type уже null), показываем прежний вид — без скачка заголовка
  const lastType = useRef<AdjustmentType>('FINE');
  if (type) lastType.current = type;
  const isFine = (type ?? lastType.current) === 'FINE';

  const handleSubmit = async () => {
    if (!type) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await accountingApi.createAdjustment({
        servicemanName: employee,
        type,
        amount: values.amount,
        reason: values.reason,
        year: month.year(),
        month: month.month() + 1,
      });
      form.resetFields();
      onClose();
      invalidate('salary');
    } catch (e) {
      // Раньше ошибка глоталась: модалка просто не закрывалась без объяснения
      notify.error(e, isFine ? 'Не удалось добавить штраф' : 'Не удалось добавить премию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isFine ? 'Добавить штраф' : 'Добавить премию'}
      open={!!type}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Добавить"
      okButtonProps={{ loading: saving, danger: isFine }}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className={shared.form}>
        <Form.Item label="Причина" name="reason" rules={[{ required: true, message: 'Укажите причину' }]}>
          <Input placeholder={isFine ? 'Опишите причину штрафа' : 'Опишите причину премии'} />
        </Form.Item>
        <Form.Item label="Сумма (р.)" name="amount" rules={[{ required: true, message: 'Укажите сумму' }]}>
          <InputNumber min={0.01} className={shared.fullWidth} precision={2} parser={parseAmount} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
