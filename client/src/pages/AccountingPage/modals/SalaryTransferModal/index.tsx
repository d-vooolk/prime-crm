import React, { useEffect, useState } from 'react';
import { Button, DatePicker, Modal, Space } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { recordsApi } from '@/api/records.api';
import { useNotify } from '@/hooks/useNotify';
import { effectiveSalaryMonth, SALARY_PERIOD_START_DAY } from '@/utils/salary';
import { useInvalidateAccounting } from '../../hooks/useAccountingData';
import styles from './SalaryTransferModal.module.scss';

export interface SalaryTransferTarget {
  recordId: string;
  /** Чья доля переносится: остальные участники сделки остаются в своём месяце */
  servicemanName: string;
  closedAt: string;
  transferredTo: { year: number; month: number } | null;
}

interface Props {
  /** Переносимая запись; null — модалка закрыта */
  target: SalaryTransferTarget | null;
  onClose: () => void;
}

const toMonth = (m: { year: number; month: number }) => dayjs().year(m.year).month(m.month - 1).startOf('month');

/** Даты расчётного месяца: с 25-го прошлого по 24-е этого */
const periodLabel = (month: Dayjs) =>
  `${month.subtract(1, 'month').date(SALARY_PERIOD_START_DAY).format('DD.MM.YYYY')} — ${month.date(SALARY_PERIOD_START_DAY - 1).format('DD.MM.YYYY')}`;

/** Перенос работ сотрудника в записи в расчёт ЗП другого месяца. Касса не меняется. */
export const SalaryTransferModal: React.FC<Props> = ({ target, onClose }) => {
  const notify = useNotify();
  const invalidate = useInvalidateAccounting();
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState<Dayjs | null>(null);

  // Уже перенесено — показываем выбранный месяц, иначе предлагаем следующий после месяца закрытия
  useEffect(() => {
    if (!target) return;
    setMonth(target.transferredTo
      ? toMonth(target.transferredTo)
      : effectiveSalaryMonth(dayjs(target.closedAt)).add(1, 'month'));
  }, [target]);

  const save = async (salaryMonth: Dayjs | null, successText: string) => {
    if (!target) return;
    setSaving(true);
    try {
      await recordsApi.setSalaryMonth(
        target.recordId,
        target.servicemanName,
        salaryMonth ? { year: salaryMonth.year(), month: salaryMonth.month() + 1 } : null,
      );
      notify.toast.success(successText);
      onClose();
      invalidate('salary', 'salaryHistory');
    } catch (e) {
      notify.error(e, 'Не удалось перенести');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Перенести в другой месяц"
      open={!!target}
      onCancel={onClose}
      onOk={() => month && save(month, `Перенесено в ${month.format('MMMM YYYY')}`)}
      okText="Перенести"
      okButtonProps={{ loading: saving, disabled: !month }}
      cancelText="Отмена"
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space className={styles.footer}>
          <Button danger disabled={!target?.transferredTo} onClick={() => save(null, 'Перенос сброшен')}>
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
        В расчёт какого месяца перенести работы сотрудника {target?.servicemanName} по этой записи.
        У других сотрудников, работавших в записи, месяц не изменится.
        Касса и приходно-расходная таблица не изменятся.
      </p>
      <DatePicker
        picker="month"
        className={styles.fullWidth}
        value={month}
        onChange={setMonth}
        format="MMMM YYYY"
        allowClear={false}
      />
      {month && <p className={styles.period}>Период: {periodLabel(month)}</p>}
    </Modal>
  );
};
