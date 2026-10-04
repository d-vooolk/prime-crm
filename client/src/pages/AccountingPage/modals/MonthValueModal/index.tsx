import React, { useEffect, useState } from 'react';
import { DatePicker, InputNumber, Modal } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useNotify } from '@/hooks/useNotify';
import { monthKey, parseAmount } from '../../utils';
import styles from './MonthValueModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  valueLabel: string;
  /** Текущее значение за месяц (по ключу YYYY-MM) — подставляется при выборе месяца */
  currentValue: (key: string) => number;
  formatValue: (v: number) => React.ReactNode;
  /** Денежная сумма (копейки, запятая) или целое количество */
  money: boolean;
  onSave: (month: Dayjs, value: number) => Promise<void>;
}

/** Ручная правка помесячной статистики (выручка, количество записей) */
export const MonthValueModal: React.FC<Props> = ({ open, onClose, title, valueLabel, currentValue, formatValue, money, onSave }) => {
  const notify = useNotify();
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  // При открытии — текущий месяц и его значение
  useEffect(() => {
    if (!open) return;
    const now = dayjs().startOf('month');
    setMonth(now);
    setValue(currentValue(monthKey(now)));
    // currentValue меняется с каждым рендером родителя — берём значение только в момент открытия
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleMonthChange = (v: Dayjs | null) => {
    if (!v) return;
    setMonth(v);
    setValue(currentValue(monthKey(v)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(month, value);
      onClose();
      notify.toast.success('Данные обновлены');
    } catch (e) {
      notify.error(e, 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Сохранить"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
      width={380}
    >
      <div className={styles.body}>
        <div>
          <div className={styles.label}>Период</div>
          <DatePicker
            picker="month"
            value={month}
            onChange={handleMonthChange}
            format="MMMM YYYY"
            allowClear={false}
            className={styles.fullWidth}
            disabledDate={d => d.isAfter(dayjs(), 'month')}
          />
        </div>
        <div>
          <div className={styles.label}>{valueLabel}</div>
          <InputNumber
            value={value}
            onChange={v => setValue(v ?? 0)}
            min={0}
            precision={money ? 2 : 0}
            className={styles.fullWidth}
            parser={money ? parseAmount : undefined}
          />
          <div className={styles.hint}>
            Текущее значение за выбранный период: <strong>{formatValue(currentValue(monthKey(month)))}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
};
