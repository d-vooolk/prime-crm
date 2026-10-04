import React, { useState } from 'react';
import { Button, DatePicker, Modal, Space } from 'antd';
import { Dayjs } from 'dayjs';
import { recordsApi } from '@/api/records.api';
import { useNotify } from '@/hooks/useNotify';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import styles from './SalaryTransferModal.module.scss';

export interface SalaryTransferTarget {
  recordId: string;
  salaryDate: Dayjs | null;
}

interface Props {
  /** Переносимая запись; null — модалка закрыта */
  target: SalaryTransferTarget | null;
  onChange: (target: SalaryTransferTarget | null) => void;
}

/** Перенос записи в расчёт ЗП другого периода. Касса не меняется. */
export const SalaryTransferModal: React.FC<Props> = ({ target, onChange }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [saving, setSaving] = useState(false);

  const save = async (salaryDate: Dayjs | null, successText: string) => {
    if (!target) return;
    setSaving(true);
    try {
      await recordsApi.setSalaryDate(target.recordId, salaryDate ? salaryDate.toISOString() : null);
      notify.toast.success(successText);
      onChange(null);
      invalidate('salary');
    } catch (e) {
      notify.error(e, 'Не удалось перенести');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Перенести на другой период"
      open={!!target}
      onCancel={() => onChange(null)}
      onOk={() => save(target?.salaryDate ?? null, 'Период перенесён')}
      okText="Перенести"
      okButtonProps={{ loading: saving }}
      cancelText="Отмена"
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space className={styles.footer}>
          <Button danger disabled={!target?.salaryDate} onClick={() => save(null, 'Перенос сброшен')}>
            Сбросить перенос
          </Button>
          <Space>
            <CancelBtn />
            <OkBtn />
          </Space>
        </Space>
      )}
    >
      <p className={styles.hint}>
        Выберите дату, в период которой нужно перенести эту запись в расчёте ЗП.
        Касса и приходно-расходная таблица не изменятся.
      </p>
      <DatePicker
        className={styles.fullWidth}
        value={target?.salaryDate ?? null}
        onChange={v => target && onChange({ ...target, salaryDate: v })}
        format="DD.MM.YYYY"
        allowClear
      />
    </Modal>
  );
};
