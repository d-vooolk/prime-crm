import React from 'react';
import { Card, Row, Col, Statistic, Avatar, Modal } from 'antd';
import cn from 'classnames';
import { SalaryData, SalaryHistoryItem } from '@/api/accounting.api';
import { Serviceman } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { averageAnnualSalary, effectiveSalaryMonth } from '@/utils/salary';
import { bestSalaryMonth, formatThousands } from '../utils';
import { useChartColors } from '../useChartColors';
import { ChartTooltip } from '../ChartTooltip';
import { MonthlyLineChart } from '../MonthlyLineChart';
import styles from './EmployeeModal.module.scss';

interface Props {
  employee: Serviceman | null;
  salary?: SalaryData;
  history: SalaryHistoryItem[];
  onClose: () => void;
}

/** Подробности по сотруднику: показатели заработка и динамика по месяцам */
export const EmployeeModal: React.FC<Props> = ({ employee, salary, history, onClose }) => {
  const colors = useChartColors();
  const record = bestSalaryMonth(history);
  const avgAnnual = averageAnnualSalary(history);
  const salaryPeriodLabel = effectiveSalaryMonth().format('MMMM YYYY');

  return (
    <Modal open={!!employee} onCancel={onClose} footer={null} title={null} width={600} destroyOnHidden>
      {employee && (
        <div className={styles.content}>
          <div className={styles.header}>
            <Avatar size={56} className={styles.avatar}>
              {employee.name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <div className={styles.name}>{employee.name}</div>
              {employee.position && <div className={styles.position}>{employee.position}</div>}
            </div>
          </div>

          <Row gutter={[12, 12]} className={styles.statsRow}>
            <Col xs={12} sm={12}>
              <Card size="small">
                <Statistic
                  className={styles.stat}
                  title="% от прибыли"
                  value={employee.profitPercent ?? 0}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col xs={12} sm={12}>
              <Card size="small">
                <Statistic
                  className={cn(styles.stat, styles.statGreen)}
                  title="Тек. период"
                  value={salary?.adjustedTotal ?? 0}
                  precision={2}
                  suffix="р."
                />
                <div className={styles.hint}>{salaryPeriodLabel}</div>
                {salary && salary.paidTotal > 0 && (
                  <div className={styles.hint}>
                    выплачено {formatPrice(salary.paidTotal)},{' '}
                    {salary.remaining < 0 ? 'переплата' : 'осталось'} {formatPrice(Math.abs(salary.remaining))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={12} sm={12}>
              <Card size="small">
                <Statistic
                  className={cn(styles.stat, styles.statPrimary)}
                  title="Средний годичный"
                  value={avgAnnual.average}
                  precision={2}
                  suffix="р."
                />
                <div className={styles.hint}>
                  {avgAnnual.monthsCount > 0
                    ? `в месяц, за последние ${avgAnnual.monthsCount} мес.`
                    : 'нет закрытых месяцев'}
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={12}>
              <Card size="small">
                <Statistic
                  className={cn(styles.stat, styles.statAmber)}
                  title="Рекорд"
                  value={record?.adjustedTotal ?? 0}
                  precision={2}
                  suffix="р."
                />
                {record && (
                  <div className={styles.hint}>
                    {history.length === 1 ? 'Первый месяц' : record.label}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {history.length > 1 ? (
            <Card size="small" title="Динамика заработка">
              <MonthlyLineChart<SalaryHistoryItem>
                data={history}
                hasData
                xKey="label"
                yKey="adjustedTotal"
                color={colors.primary}
                gridColor={colors.grid}
                height={200}
                yWidth={40}
                yTickFormatter={formatThousands}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                renderTooltip={item => (
                  <ChartTooltip
                    label={item.label}
                    name="Заработок"
                    tone="green"
                    value={formatPrice(item.adjustedTotal)}
                    hint={`Машин: ${item.recordCount}`}
                  />
                )}
              />
            </Card>
          ) : (
            <div className={styles.noChart}>Недостаточно данных для графика</div>
          )}
        </div>
      )}
    </Modal>
  );
};
