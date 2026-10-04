import React, { useMemo, useState } from 'react';
import { Card, Col, DatePicker, Empty, Row, Statistic, Table, Tooltip as AntTooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { analyticsApi } from '@/api/analytics.api';
import { LoadError } from '@/components/Shared/LoadError';
import { useCssVars } from '@/hooks/useCssVars';
import type { ClientSource, SourceStatsRow } from '@/types';
import { formatPrice } from '@/utils/formatters';
import { CLIENT_SOURCES, clientSourceLabel } from '@/utils/clientSource';
import styles from './SourcesTab.module.scss';

interface Props {
  /** Выручку по каналам видят директора, как и на главной вкладке */
  canSeeRevenue: boolean;
}

type SourceKey = ClientSource | 'NONE';
const SOURCE_KEYS: SourceKey[] = [...CLIENT_SOURCES, 'NONE'];

const COLOR_VARS = [
  '--color-chart-1', '--color-chart-2', '--color-chart-3', '--color-chart-4', '--color-chart-5', '--color-chart-6', '--color-chart-grid',
] as const;

const PRESETS: Array<{ label: string; value: [Dayjs, Dayjs] }> = [
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs()] },
  { label: '3 месяца', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs()] },
  { label: 'Полгода', value: [dayjs().subtract(5, 'month').startOf('month'), dayjs()] },
  { label: 'Этот год', value: [dayjs().startOf('year'), dayjs()] },
  { label: '12 месяцев', value: [dayjs().subtract(11, 'month').startOf('month'), dayjs()] },
];

/** Вкладка «Каналы привлечения»: откуда приходят клиенты и как они конвертируются в сделки */
export const SourcesTab: React.FC<Props> = ({ canSeeRevenue }) => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(PRESETS[4].value);
  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['analytics', 'sources', from, to],
    queryFn: () => analyticsApi.getSources(from, to),
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });

  const vars = useCssVars(COLOR_VARS);
  // «Не указан» — нейтральным цветом сетки, чтобы не спорил с настоящими каналами
  const colorOf = (key: SourceKey) => (key === 'NONE'
    ? vars['--color-chart-grid']
    : vars[COLOR_VARS[CLIENT_SOURCES.indexOf(key) % 6]]);

  const chartData = useMemo(() => (data?.months ?? []).map(m => ({
    month: dayjs(`${m.month}-01`).format('MMM YY'),
    ...Object.fromEntries(SOURCE_KEYS.map(k => [k, m.counts[k] ?? 0])),
  })), [data]);
  const presentKeys = SOURCE_KEYS.filter(k => data?.sources.some(s => s.source === k));

  const known = data?.sources.filter(s => s.source !== 'NONE') ?? [];
  const best = [...known].sort((a, b) => b.newClients - a.newClients)[0];
  const noneShare = data && data.sources.length
    ? Math.round(((data.sources.find(s => s.source === 'NONE')?.records ?? 0) / data.sources.reduce((s, r) => s + r.records, 0)) * 100)
    : 0;

  if (isError) return <LoadError title="Не удалось загрузить каналы привлечения" error={error} onRetry={() => refetch()} />;

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <DatePicker.RangePicker
          value={range}
          onChange={v => v?.[0] && v[1] && setRange([v[0], v[1]])}
          presets={PRESETS}
          format="DD.MM.YYYY"
          allowClear={false}
        />
        {noneShare > 0 && (
          <span className={styles.hint}>
            У {noneShare}% записей источник не указан — заполняйте поле «Источник клиента» в записи
          </span>
        )}
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic title="Новых клиентов" value={data?.newClients ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic title="Лучший канал" value={best ? clientSourceLabel(best.source) : '—'} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic
              title={(
                <span>
                  Расходы на рекламу{' '}
                  <AntTooltip title="Расходы кассы за период в категориях со словом «реклама»">
                    <QuestionCircleOutlined />
                  </AntTooltip>
                </span>
              )}
              value={formatPrice(data?.adExpenses ?? 0)}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic
              title="Цена нового клиента"
              value={data?.costPerNewClient != null ? formatPrice(data.costPerNewClient) : '—'}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Записи по месяцам и каналам" className={styles.card}>
        {chartData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет записей за период" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={vars['--color-chart-grid']} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip />
              <Legend formatter={(v: string) => clientSourceLabel(v as SourceKey)} />
              {presentKeys.map(k => (
                <Bar key={k} dataKey={k} name={k} stackId="sources" fill={colorOf(k)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Table<SourceStatsRow>
        dataSource={data?.sources ?? []}
        rowKey="source"
        size="small"
        loading={isFetching}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: 'Нет записей за период' }}
        columns={[
          {
            title: 'Канал', key: 'source',
            render: (_, r) => (
              <span className={styles.source}>
                <span className={styles.dot} data-source={r.source} />
                {clientSourceLabel(r.source)}
              </span>
            ),
          },
          { title: 'Записей', dataIndex: 'records', key: 'records', width: 90, sorter: (a, b) => a.records - b.records },
          { title: 'Новых клиентов', dataIndex: 'newClients', key: 'newClients', width: 130, sorter: (a, b) => a.newClients - b.newClients },
          { title: 'Закрыто', dataIndex: 'closed', key: 'closed', width: 90 },
          { title: 'Отменено', dataIndex: 'cancelled', key: 'cancelled', width: 100 },
          {
            title: (
              <AntTooltip title="Доля закрытых сделок среди неотменённых записей">Конверсия</AntTooltip>
            ),
            key: 'conversion', width: 110, sorter: (a, b) => a.conversion - b.conversion,
            render: (_, r) => `${r.conversion}%`,
          },
          { title: 'Средний чек', key: 'avgCheck', width: 120, render: (_, r) => (r.avgCheck ? formatPrice(r.avgCheck) : '—') },
          ...(canSeeRevenue ? [{
            title: 'Выручка', key: 'revenue', width: 130,
            sorter: (a: SourceStatsRow, b: SourceStatsRow) => a.revenue - b.revenue,
            render: (_: unknown, r: SourceStatsRow) => formatPrice(r.revenue),
          }] : []),
        ]}
      />
    </div>
  );
};
