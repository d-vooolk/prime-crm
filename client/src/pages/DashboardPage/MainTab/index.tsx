import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Row, Col, Select, Statistic, Skeleton } from 'antd';
import { CheckCircleOutlined, DollarOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Period } from '@/api/analytics.api';
import { MonthlyRecordCountItem, MonthlyRevenueItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useDashboardData } from '../hooks';
import { AvgCheckItem, buildAvgCheckData, formatThousands, overallAvgCheck } from '../utils';
import { useChartColors } from '../useChartColors';
import { ChartTooltip } from '../ChartTooltip';
import { MonthlyLineChart } from '../MonthlyLineChart';
import styles from './MainTab.module.scss';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

interface Props {
  canSeeRevenue: boolean;
  canSeeAvgCard: boolean;
}

/** Вкладка «Основные показатели»: карточки за период, помесячные графики и топ услуг */
export const MainTab: React.FC<Props> = ({ canSeeRevenue, canSeeAvgCard }) => {
  const [period, setPeriod] = useState<Period>('month');
  const { summary, topServices, monthlyRevenue, monthlyRecordCount, loading, error, reload } = useDashboardData(period);
  const colors = useChartColors();

  const avgCheckData = useMemo(() => buildAvgCheckData(monthlyRevenue, monthlyRecordCount), [monthlyRevenue, monthlyRecordCount]);
  const overallAvg = useMemo(() => overallAvgCheck(avgCheckData), [avgCheckData]);

  const statCol = canSeeAvgCard ? 6 : 8;
  const statCard = (node: React.ReactNode) => (
    <Card>{loading ? <Skeleton active paragraph={{ rows: 1 }} /> : node}</Card>
  );

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} className={styles.periodSelect} />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить часть показателей"
          description={error}
          action={<Button size="small" onClick={reload}>Повторить</Button>}
        />
      )}

      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={12} sm={statCol}>
          {statCard(
            <Statistic
              title="Закрытых сделок"
              value={summary?.closedCount || 0}
              prefix={<CheckCircleOutlined className={styles.iconGreen} />}
            />,
          )}
        </Col>
        <Col xs={12} sm={statCol}>
          {statCard(
            <Statistic
              title="Выручка"
              value={summary?.totalRevenue || 0}
              formatter={v => formatPrice(Number(v))}
              prefix={<DollarOutlined className={styles.iconBlue} />}
            />,
          )}
        </Col>
        <Col xs={12} sm={statCol}>
          {statCard(
            <Statistic
              title="Средний чек"
              value={summary?.closedCount ? (summary.totalRevenue / summary.closedCount) : 0}
              formatter={v => formatPrice(Number(v))}
              prefix={<TeamOutlined className={styles.iconPurple} />}
            />,
          )}
        </Col>
        {canSeeAvgCard && (
          <Col xs={12} sm={6}>
            {statCard(
              <Statistic
                title="Ср. чек (за всё время)"
                value={overallAvg}
                formatter={v => formatPrice(Number(v))}
                prefix={<TrophyOutlined className={styles.iconAmber} />}
              />,
            )}
          </Col>
        )}
      </Row>

      <Row gutter={[16, 16]}>
        {canSeeRevenue && (
          <Col xs={24} lg={14}>
            <div className={styles.chartsColumn}>
              <Card title="Выручка по месяцам">
                <MonthlyLineChart<MonthlyRevenueItem>
                  data={monthlyRevenue}
                  hasData={monthlyRevenue.length > 1}
                  xKey="labelShort"
                  yKey="amount"
                  color={colors.blue}
                  gridColor={colors.grid}
                  height={160}
                  yWidth={44}
                  yTickFormatter={formatThousands}
                  renderTooltip={item => (
                    <ChartTooltip label={item.label} name="Выручка" tone="green" value={formatPrice(item.amount)} />
                  )}
                />
              </Card>

              <Card title="Количество записей по месяцам">
                <MonthlyLineChart<MonthlyRecordCountItem>
                  data={monthlyRecordCount}
                  hasData={monthlyRecordCount.length > 1}
                  xKey="labelShort"
                  yKey="count"
                  color={colors.blue}
                  gridColor={colors.grid}
                  height={160}
                  yWidth={32}
                  renderTooltip={item => (
                    <ChartTooltip label={item.label} name="Записей" tone="blue" value={item.count} />
                  )}
                />
              </Card>

              <Card title="Средний чек по месяцам">
                <MonthlyLineChart<AvgCheckItem>
                  data={avgCheckData}
                  hasData={avgCheckData.filter(r => r.avg > 0).length > 1}
                  xKey="labelShort"
                  yKey="avg"
                  color={colors.amber}
                  gridColor={colors.grid}
                  height={160}
                  yWidth={44}
                  yTickFormatter={formatThousands}
                  renderTooltip={item => (
                    <ChartTooltip
                      label={item.label}
                      name="Средний чек"
                      tone="amber"
                      value={item.avg > 0 ? formatPrice(item.avg) : '—'}
                    />
                  )}
                />
              </Card>
            </div>
          </Col>
        )}
        <Col xs={24} lg={canSeeRevenue ? 10 : 24}>
          <Card title="Топ услуг">
            {topServices.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topServices} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="service.name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => [`${v} раз`, 'Кол-во']} />
                  <Bar dataKey="count" fill={colors.blue} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.emptyTop}>Нет данных</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
