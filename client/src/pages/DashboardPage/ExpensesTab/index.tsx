import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Grid, Row, Segmented, Statistic, Table, Tag, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { expensesApi, ExpenseAnalytics, ExpenseAnalyticsGroup, ExpenseAnalyticsItem } from '@/api/expenses.api';
import { formatPrice } from '@/utils/formatters';
import styles from './ExpensesTab.module.scss';

// Исключённые из графика и таблицы группы (ключи групп) — запоминаются между визитами
const EXCLUDED_STORAGE_KEY = 'prime-crm-dashboard-expenses-excluded';

// Цветных слотов 8 (палитра в ExpensesTab.module.scss, проверена на различимость для дальтоников).
// Остальные группы на графике сворачиваются в серое «Остальное»
const SERIES_SLOTS = 8;
const OTHER_SERIES = { key: 'other', name: 'Остальное', color: 'var(--expenses-series-other)' };
const seriesColor = (slot: number) => `var(--expenses-series-${slot + 1})`;
// Класс образца цвета в легенде/таблице для слота (null — «Остальное»)
const swatchClass = (slot: number | null) =>
  `${styles.swatch} ${slot === null ? styles.seriesOther : styles[`series${slot + 1}`]}`;

// Системные группы — их убирает предустановка «Только операционные»
const SYSTEM_GROUP_KEYS = ['system:founderSalary', 'system:salaryPayment', 'system:capitalTransfer', 'system:debtPayment'];

type PeriodMode = 'year' | 'range';

function loadExcluded(): string[] {
  try {
    const raw = localStorage.getItem(EXCLUDED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const isSystemGroup = (g: ExpenseAnalyticsGroup) => g.kind === 'system';

interface ChartSeries {
  key: string;
  name: string;
  color: string;
  // Ключи групп, которые входят в серию (у «Остального» — несколько)
  groupKeys: string[];
}

interface ChartRow {
  month: string;
  label: string;
  total: number;
  [seriesKey: string]: number | string;
}

interface ExpensesTooltipProps {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  series: ChartSeries[];
}

const ExpensesTooltip: React.FC<ExpensesTooltipProps> = ({ active, payload, series }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const rows = series
    .map(s => ({ ...s, value: Number(row[s.key] ?? 0) }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{dayjs(`${row.month}-01`).format('MMMM YYYY')}</div>
      {rows.map(s => (
        <div key={s.key} className={styles.tooltipRow}>
          <svg className={styles.lineKey} viewBox="0 0 12 2" aria-hidden><line x1="0" y1="1" x2="12" y2="1" stroke={s.color} strokeWidth="2" /></svg>
          <strong className={styles.tooltipValue}>{formatPrice(s.value)}</strong>
          <span className={styles.tooltipName}>{s.name}</span>
        </div>
      ))}
      <div className={styles.tooltipTotal}>
        Итого: <strong>{formatPrice(row.total)}</strong>
      </div>
    </div>
  );
};

const itemColumns = [
  { title: 'Дата', dataIndex: 'date', key: 'date', width: 96, render: (d: string) => dayjs(d).format('DD.MM.YYYY') },
  { title: 'Описание', dataIndex: 'description', key: 'description', render: (v: string | null) => v || '—' },
  {
    title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 110, align: 'right' as const,
    render: (v: number) => formatPrice(v),
  },
  { title: 'Кто', dataIndex: 'person', key: 'person', width: 130, render: (v: string | null) => v || '—' },
];

/** Вкладка «Расходы» на дашборде: расходы кассы по месяцам и группам (только для создателя). */
export const ExpensesTab: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [mode, setMode] = useState<PeriodMode>('year');
  const [year, setYear] = useState<Dayjs>(() => dayjs().startOf('year'));
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().subtract(11, 'month').startOf('month'), dayjs().startOf('month')]);
  const [data, setData] = useState<ExpenseAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [excluded, setExcluded] = useState<string[]>(loadExcluded);

  const [from, to] = mode === 'year'
    ? [year.format('YYYY-01'), year.format('YYYY-12')]
    : [range[0].format('YYYY-MM'), range[1].format('YYYY-MM')];

  useEffect(() => {
    setLoading(true);
    expensesApi.getAnalytics(from, to)
      .then(setData)
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify(excluded));
  }, [excluded]);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const visibleGroups = useMemo(() => groups.filter(g => !excludedSet.has(g.key)), [groups, excludedSet]);

  // Цвет закреплён за группой по её месту среди ВСЕХ групп периода, поэтому
  // исключение одной группы не перекрашивает остальные
  const slotByGroup = useMemo(() => {
    const map = new Map<string, number | null>();
    groups.forEach((g, i) => map.set(g.key, i < SERIES_SLOTS ? i : null));
    return map;
  }, [groups]);
  const groupSwatch = (key: string) => swatchClass(slotByGroup.get(key) ?? null);

  const series = useMemo<ChartSeries[]>(() => {
    const own: ChartSeries[] = [];
    const rest: string[] = [];
    groups.forEach((g, i) => {
      if (excludedSet.has(g.key)) return;
      if (i < SERIES_SLOTS) own.push({ key: `s${i}`, name: g.name, color: seriesColor(i), groupKeys: [g.key] });
      else rest.push(g.key);
    });
    return rest.length ? [...own, { ...OTHER_SERIES, groupKeys: rest }] : own;
  }, [groups, excludedSet]);

  const chartData = useMemo<ChartRow[]>(() => (data?.months ?? []).map(m => {
    const row: ChartRow = { month: m.month, label: dayjs(`${m.month}-01`).format('MMM YY'), total: 0 };
    for (const s of series) {
      const value = s.groupKeys.reduce((sum, key) => sum + (m.totals[key] ?? 0), 0);
      row[s.key] = value;
      row.total += value;
    }
    return row;
  }), [data, series]);

  const total = visibleGroups.reduce((s, g) => s + g.total, 0);
  const operationsCount = visibleGroups.reduce((s, g) => s + g.count, 0);
  // Среднее — по уже наступившим месяцам периода, будущие не размывают его
  const elapsedMonths = (data?.months ?? []).filter(m => !dayjs(`${m.month}-01`).isAfter(dayjs(), 'month')).length;
  const average = elapsedMonths > 0 ? total / elapsedMonths : 0;
  const biggest = visibleGroups[0];

  const toggleGroup = (key: string) =>
    setExcluded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const showAll = () => setExcluded([]);
  const onlyOperational = () => setExcluded(SYSTEM_GROUP_KEYS);
  const isOnlyOperational = excluded.length === SYSTEM_GROUP_KEYS.length
    && SYSTEM_GROUP_KEYS.every(k => excludedSet.has(k));

  const groupColumns = [
    {
      title: 'Группа', key: 'name',
      render: (_: unknown, g: ExpenseAnalyticsGroup) => (
        <span className={styles.groupName}>
          <span className={groupSwatch(g.key)} />
          {g.name}
          {isSystemGroup(g) && <Tag className={styles.systemTag}>системный</Tag>}
        </span>
      ),
    },
    {
      title: 'Сумма', dataIndex: 'total', key: 'total', width: 120, align: 'right' as const,
      render: (v: number) => <strong>{formatPrice(v)}</strong>,
    },
    {
      title: 'Доля', key: 'share', width: 80, align: 'right' as const,
      render: (_: unknown, g: ExpenseAnalyticsGroup) => total > 0 ? `${((g.total / total) * 100).toFixed(1)}%` : '—',
    },
    ...(isMobile ? [] : [{ title: 'Операций', dataIndex: 'count', key: 'count', width: 100, align: 'right' as const }]),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        <Segmented<PeriodMode>
          value={mode}
          onChange={setMode}
          options={[{ value: 'year', label: 'Год' }, { value: 'range', label: 'Период' }]}
        />
        {mode === 'year' ? (
          <DatePicker
            picker="year"
            value={year}
            onChange={v => v && setYear(v.startOf('year'))}
            allowClear={false}
          />
        ) : (
          <DatePicker.RangePicker
            picker="month"
            value={range}
            format="MM.YYYY"
            onChange={v => { if (v?.[0] && v[1]) setRange([v[0].startOf('month'), v[1].startOf('month')]); }}
            allowClear={false}
            className={styles.rangePicker}
          />
        )}
      </div>

      {groups.length > 0 && (
        <div className={styles.groupFilter}>
          <div className={styles.groupFilterActions}>
            <Button size="small" type={excluded.length === 0 ? 'primary' : 'default'} onClick={showAll}>Все</Button>
            <Button size="small" type={isOnlyOperational ? 'primary' : 'default'} onClick={onlyOperational}>
              Только операционные
            </Button>
          </div>
          <div className={styles.groupTags}>
            {groups.map(g => {
              const checked = !excludedSet.has(g.key);
              return (
                <Tag.CheckableTag
                  key={g.key}
                  checked={checked}
                  onChange={() => toggleGroup(g.key)}
                  className={checked ? styles.groupTag : `${styles.groupTag} ${styles.groupTagOff}`}
                >
                  <span className={groupSwatch(g.key)} />
                  {g.name}
                </Tag.CheckableTag>
              );
            })}
          </div>
        </div>
      )}

      <div className={loading && data ? styles.refreshing : undefined}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={8}>
            <Card size="small">
              <Statistic title="Итого за период" value={total} precision={0} suffix="р." loading={loading && !data} />
              <div className={styles.statHint}>{operationsCount} операций</div>
            </Card>
          </Col>
          <Col xs={12} md={8}>
            <Card size="small">
              <Statistic title="В среднем в месяц" value={average} precision={0} suffix="р." loading={loading && !data} />
              <div className={styles.statHint}>за {elapsedMonths} мес.</div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small">
              <Statistic
                title="Крупнейшая группа"
                value={biggest ? biggest.name : '—'}
                loading={loading && !data}
                className={styles.biggestStat}
              />
              {biggest && total > 0 && (
                <div className={styles.statHint}>
                  {formatPrice(biggest.total)} · {((biggest.total / total) * 100).toFixed(0)}%
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Card title="Расходы по месяцам" className={styles.card}>
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  interval={isMobile ? 'preserveStartEnd' : 0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface-2)' }}
                  content={<ExpensesTooltip series={series} />}
                />
                {series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="expenses"
                    fill={s.color}
                    stroke="var(--color-surface)"
                    strokeWidth={1}
                    maxBarSize={24}
                    // Скругляем только верх стопки
                    radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty description={loading ? 'Загрузка…' : 'Нет расходов за период'} />
          )}
        </Card>

        <Card title="Группы расходов" className={styles.card}>
          <Table<ExpenseAnalyticsGroup>
            dataSource={visibleGroups}
            columns={groupColumns}
            rowKey="key"
            size="small"
            pagination={false}
            loading={loading && !data}
            locale={{ emptyText: <Empty description="Нет расходов за период" /> }}
            expandable={{
              expandedRowRender: g => (
                <Table<ExpenseAnalyticsItem>
                  dataSource={g.items}
                  columns={itemColumns}
                  rowKey="id"
                  size="small"
                  pagination={g.items.length > 10 ? { pageSize: 10, size: 'small', showSizeChanger: false } : false}
                  scroll={{ x: 'max-content' }}
                />
              ),
            }}
            summary={() => visibleGroups.length > 0 && (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} />
                <Table.Summary.Cell index={1}><strong>Итого</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><strong>{formatPrice(total)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">100%</Table.Summary.Cell>
                {!isMobile && <Table.Summary.Cell index={4} align="right">{operationsCount}</Table.Summary.Cell>}
              </Table.Summary.Row>
            )}
          />
        </Card>
      </div>
    </div>
  );
};
