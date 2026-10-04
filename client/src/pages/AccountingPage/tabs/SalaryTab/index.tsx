import React, { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Select, Tag } from 'antd';
import { MinusOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { SalaryRecord } from '@/api/accounting.api';
import { AuthUser } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { effectiveSalaryMonth, hasSalary } from '@/utils/salary';
import { isEmployee } from '@/utils/roles';
import { useAllServicemen } from '@/hooks/useReferenceData';
import { useSalary, useSalaryHistory } from '../../hooks/useAccountingData';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { SalaryPayModal } from '../../modals/SalaryPayModal';
import { AdjustmentModal, AdjustmentType } from '../../modals/AdjustmentModal';
import { SalaryTransferModal, SalaryTransferTarget } from '../../modals/SalaryTransferModal';
import { SalaryStats } from './SalaryStats';
import { SalaryChart } from './SalaryChart';
import { SalaryRecords } from './SalaryRecords';
import { SalaryAdjustments } from './SalaryAdjustments';
import { SalaryPayments } from './SalaryPayments';
import { SalaryTotals } from './SalaryTotals';
import shared from '../../shared.module.scss';
import styles from './SalaryTab.module.scss';

interface Props {
  user: AuthUser | null;
  isMobile: boolean;
  /** Выплаты и перенос периода — тем, кто видит кассу */
  canSeeCashflow: boolean;
  canSeeClientName: boolean;
}

/** Расчёт ЗП сотрудника за расчётный месяц. Сотрудник видит только себя и соседние месяцы. */
export const SalaryTab: React.FC<Props> = ({ user, isMobile, canSeeCashflow, canSeeClientName }) => {
  const employeeMode = isEmployee(user);
  const { data: allServicemen = [] } = useAllServicemen();
  const employees = useMemo(() => allServicemen.filter(s => hasSalary(s) && !s.isDismissed), [allServicemen]);

  const [month, setMonth] = useState<Dayjs>(() => effectiveSalaryMonth());
  const [employee, setEmployee] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [adjustment, setAdjustment] = useState<AdjustmentType | null>(null);
  const [transfer, setTransfer] = useState<SalaryTransferTarget | null>(null);

  // Сотруднику сразу открываем его собственный расчёт
  useEffect(() => {
    if (employeeMode && user?.name && !employee) setEmployee(user.name);
  }, [employeeMode, user, employee]);

  const salary = useSalary(employee, month);
  const historyQuery = useSalaryHistory(employee);
  // Без сотрудника запросы выключены, а keepPreviousData держал бы прежний расчёт
  const salaryData = employee ? salary.data ?? null : null;
  const history = employee ? historyQuery.data ?? [] : [];

  const effectiveCurrentMonth = effectiveSalaryMonth();
  const effectivePrevMonth = effectiveCurrentMonth.subtract(1, 'month');

  const periodLabel = salaryData
    ? `${dayjs(salaryData.periodFrom).format('DD.MM.YYYY')} — ${dayjs(salaryData.periodTo).subtract(1, 'day').format('DD.MM.YYYY')}`
    : '';

  const openTransfer = (row: SalaryRecord) => setTransfer({
    recordId: row.recordId,
    salaryDate: row.salaryDate ? dayjs(row.salaryDate) : null,
  });

  return (
    <div className={shared.tabContent}>
      {employee && (
        <LoadErrorAlert
          errors={[salary.error, historyQuery.error]}
          title="Не удалось загрузить расчёт ЗП"
          onRetry={() => { salary.refetch(); historyQuery.refetch(); }}
        />
      )}

      {employee && <SalaryStats salaryData={salaryData} history={history} />}

      <div className={styles.controls}>
        {!employeeMode && (
          <Select
            showSearch
            className={styles.employeeSelect}
            placeholder="Выберите сотрудника"
            value={employee || undefined}
            onChange={setEmployee}
            options={employees.map(e => ({ value: e.name, label: e.name }))}
            allowClear
            onClear={() => setEmployee('')}
          />
        )}
        {employeeMode ? (
          <div className={styles.monthNav}>
            <Button
              size="small"
              disabled={!month.isAfter(effectivePrevMonth, 'month')}
              onClick={() => setMonth(prev => prev.subtract(1, 'month'))}
            >←</Button>
            <span className={styles.monthNavLabel}>{month.format('MMMM YYYY')}</span>
            <Button
              size="small"
              disabled={!month.isBefore(effectiveCurrentMonth, 'month')}
              onClick={() => setMonth(prev => prev.add(1, 'month'))}
            >→</Button>
          </div>
        ) : (
          <DatePicker
            picker="month"
            className={styles.monthPicker}
            value={month}
            onChange={v => v && setMonth(v)}
            format="MMMM YYYY"
            allowClear={false}
          />
        )}
        {!employeeMode && employee && (
          <div className={styles.adjustButtons}>
            <Button danger icon={<MinusOutlined />} onClick={() => setAdjustment('FINE')}>Штраф</Button>
            <Button className={styles.bonusButton} icon={<PlusOutlined />} onClick={() => setAdjustment('BONUS')}>
              Премия
            </Button>
          </div>
        )}
        {canSeeCashflow && employee && salaryData && (
          <Button type="primary" icon={<WalletOutlined />} onClick={() => setPayOpen(true)} className={styles.payButton}>
            Выплатить ЗП
          </Button>
        )}
      </div>

      {employee && history.length > 1 && <SalaryChart history={history} loading={historyQuery.isLoading} />}

      {employee && salaryData ? (
        <>
          <div className={styles.period}>
            <span>Период: <strong>{periodLabel}</strong></span>
            {salaryData.profitPercent > 0 && (
              <span>Процент: <Tag color="blue" className={styles.percentTag}>{salaryData.profitPercent}%</Tag></span>
            )}
            {salaryData.baseSalary > 0 && (
              <span>Оклад: <strong>{formatPrice(salaryData.baseSalary)}</strong></span>
            )}
          </div>

          <SalaryRecords
            salaryData={salaryData}
            loading={salary.isFetching}
            isMobile={isMobile}
            canSeeClientName={canSeeClientName}
            canTransfer={canSeeCashflow}
            onTransfer={openTransfer}
          />
          <SalaryAdjustments adjustments={salaryData.adjustments} canDelete={!employeeMode} />
          <SalaryPayments payments={salaryData.payments} canDelete={canSeeCashflow} />
          <SalaryTotals salaryData={salaryData} isMobile={isMobile} />
        </>
      ) : (
        !salary.error && (
          <Empty description={employee ? 'Нет данных за период' : 'Выберите сотрудника'} className={styles.empty} />
        )
      )}

      <SalaryPayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        employee={employee}
        month={month}
        salaryData={salaryData}
        periodLabel={periodLabel}
      />
      <AdjustmentModal type={adjustment} onClose={() => setAdjustment(null)} employee={employee} month={month} />
      <SalaryTransferModal target={transfer} onChange={setTransfer} />
    </div>
  );
};
