import React, { useState } from 'react';
import { Button, Card, Statistic, Table } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { accountingApi, MonthlyRecordCountItem, MonthlyRevenueItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useInvalidateAccounting, useMonthlyRecordCount, useMonthlyRevenue } from '../../hooks/useAccountingData';
import { avgCheckColumns, recordCountColumns, revenueColumns } from '../../columns/statsColumns';
import { LoadErrorAlert } from '../../parts/LoadErrorAlert';
import { MonthValueModal } from '../../modals/MonthValueModal';
import { AvgCheckRow, buildAvgCheckRows, buildStatsChartData, overallAvgCheck } from '../../utils';
import { StatsChart } from './StatsChart';
import shared from '../../shared.module.scss';
import styles from './StatsTab.module.scss';

/** Статистика: выручка, количество записей и средний чек по месяцам (с ручной правкой) */
export const StatsTab: React.FC = () => {
  const invalidate = useInvalidateAccounting();
  const revenueQuery = useMonthlyRevenue(true);
  const countQuery = useMonthlyRecordCount(true);
  const [revenueEditOpen, setRevenueEditOpen] = useState(false);
  const [countEditOpen, setCountEditOpen] = useState(false);

  const revenue = revenueQuery.data ?? [];
  const recordCount = countQuery.data ?? [];
  const chartData = buildStatsChartData(revenue, recordCount);
  const avgRows = buildAvgCheckRows(revenue, recordCount);
  const overallAvg = overallAvgCheck(avgRows);

  return (
    <div className={shared.tabContent}>
      <LoadErrorAlert
        errors={[revenueQuery.error, countQuery.error]}
        title="Не удалось загрузить статистику"
        onRetry={() => { revenueQuery.refetch(); countQuery.refetch(); }}
      />

      <div className={styles.topRow}>
        <Card size="small" title="Выручка и записи по месяцам" className={styles.chartCard}>
          {chartData.length > 1
            ? <StatsChart data={chartData} />
            : <div className={styles.noChart}>Недостаточно данных для графика</div>}
        </Card>

        <Card size="small" className={styles.avgCard}>
          <Statistic
            title="Средний чек (за всё время)"
            value={overallAvg}
            precision={2}
            suffix="р."
            className={cn(shared.stat, shared.statWarning)}
          />
        </Card>
      </div>

      <div className={styles.layout}>
        <div>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>Выручка по месяцам</span>
            <Button size="small" icon={<EditOutlined />} onClick={() => setRevenueEditOpen(true)}>Изменить</Button>
          </div>
          <Table<MonthlyRevenueItem>
            dataSource={revenue}
            rowKey="key"
            size="small"
            pagination={false}
            loading={revenueQuery.isLoading}
            locale={{ emptyText: 'Нет данных' }}
            columns={revenueColumns}
          />
        </div>

        <div>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>Количество записей по месяцам</span>
            <Button size="small" icon={<EditOutlined />} onClick={() => setCountEditOpen(true)}>Изменить</Button>
          </div>
          <Table<MonthlyRecordCountItem>
            dataSource={recordCount}
            rowKey="key"
            size="small"
            pagination={false}
            loading={countQuery.isLoading}
            locale={{ emptyText: 'Нет данных' }}
            columns={recordCountColumns}
          />
        </div>

        <div>
          <div className={cn(styles.tableHeader, styles.tableTitle)}>Средний чек по месяцам</div>
          <Table<AvgCheckRow>
            dataSource={avgRows}
            rowKey="key"
            size="small"
            pagination={false}
            locale={{ emptyText: 'Нет данных' }}
            columns={avgCheckColumns}
          />
        </div>
      </div>

      <MonthValueModal
        open={revenueEditOpen}
        onClose={() => setRevenueEditOpen(false)}
        title="Изменить данные выручки"
        valueLabel="Сумма (р.)"
        money
        currentValue={key => revenue.find(r => r.key === key)?.amount ?? 0}
        formatValue={formatPrice}
        onSave={async (month, value) => {
          await accountingApi.setMonthlyRevenue(month.year(), month.month() + 1, value);
          await invalidate('monthlyRevenue');
        }}
      />

      <MonthValueModal
        open={countEditOpen}
        onClose={() => setCountEditOpen(false)}
        title="Изменить данные записей"
        valueLabel="Количество записей"
        money={false}
        currentValue={key => recordCount.find(r => r.key === key)?.count ?? 0}
        formatValue={v => v}
        onSave={async (month, value) => {
          await accountingApi.setMonthlyRecordCount(month.year(), month.month() + 1, value);
          await invalidate('monthlyRecordCount');
        }}
      />
    </div>
  );
};
