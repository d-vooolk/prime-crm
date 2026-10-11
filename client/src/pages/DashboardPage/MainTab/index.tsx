import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Grid, Segmented, Select } from 'antd';
import { CheckCircleOutlined, DollarOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons';
import { Period } from '@/api/analytics.api';
import { MonthlyRecordCountItem, MonthlyRevenueItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useDashboardData } from '../hooks';
import { AvgCheckItem, buildAvgCheckData, formatThousands, overallAvgCheck } from '../utils';
import { achievements, growthStreak, monthGoal, MonthPoint, workshopLevel } from '../gamification';
import { ChartTooltip } from '../ChartTooltip';
import { MonthlyLineChart } from '../MonthlyLineChart';
import { KpiTile } from '../KpiTile';
import { GamePanel } from '../GamePanel';
import { TopServicesDonut } from '../TopServicesDonut';
import styles from './MainTab.module.scss';

const { useBreakpoint } = Grid;

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
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

interface PanelProps {
  kicker: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}

/** Карточка графика: салатовая метка раздела и заголовок, как на странице записи */
const Panel: React.FC<PanelProps> = ({ kicker, title, className, children }) => (
  <section className={`${styles.panel} ${className ?? ''}`}>
    <div className={styles.panelKicker}>{kicker}</div>
    <h3 className={styles.panelTitle}>{title}</h3>
    {children}
  </section>
);

const toPoints = <T extends { year: number; month: number }>(items: T[], value: (item: T) => number): MonthPoint[] =>
  items.map(i => ({ year: i.year, month: i.month, value: value(i) }));

/** Вкладка «Основные показатели»: игровая панель, плитки за период, неоновые графики и топ услуг */
export const MainTab: React.FC<Props> = ({ canSeeRevenue, canSeeAvgCard }) => {
  const screens = useBreakpoint();
  const [period, setPeriod] = useState<Period>('month');
  const { summary, topServices, monthlyRevenue, monthlyRecordCount, loading, error, reload } = useDashboardData(period);

  const avgCheckData = useMemo(() => buildAvgCheckData(monthlyRevenue, monthlyRecordCount), [monthlyRevenue, monthlyRecordCount]);
  const overallAvg = useMemo(() => overallAvgCheck(avgCheckData), [avgCheckData]);

  // ─── Геймификация ─────────────────────────────────
  const game = useMemo(() => {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;
    const isPast = (p: MonthPoint) => p.year < year || (p.year === year && p.month < month);

    const recordPoints = toPoints<MonthlyRecordCountItem>(monthlyRecordCount, i => i.count);
    const revenuePoints = toPoints<MonthlyRevenueItem>(monthlyRevenue, i => i.amount);
    const recordsGoal = monthGoal(recordPoints, year, month);
    const revenueGoal = canSeeRevenue ? monthGoal(revenuePoints, year, month) : null;
    const streakSource = canSeeRevenue ? revenuePoints : recordPoints;
    const streak = growthStreak(streakSource.filter(isPast).map(p => p.value));
    const totalRecords = recordPoints.reduce((s, p) => s + p.value, 0);
    const topServiceCount = topServices.reduce((max, s) => Math.max(max, s.count), 0);

    return {
      level: workshopLevel(totalRecords),
      recordsGoal,
      revenueGoal,
      streak,
      achievements: achievements({ totalRecords, recordsGoal, revenueGoal, streak, topServiceCount }),
    };
  }, [monthlyRecordCount, monthlyRevenue, topServices, canSeeRevenue]);

  // Изменение к прошлому месяцу имеет смысл только для периода «Месяц»
  const monthDelta = (goal: { deltaPct: number | null } | null) => (period === 'month' ? goal?.deltaPct ?? null : null);
  const avgGoal = useMemo(() => {
    const now = dayjs();
    // Ряд среднего чека построен по ряду выручки — индексы совпадают
    const points = monthlyRevenue.map((r, i) => ({ year: r.year, month: r.month, value: avgCheckData[i]?.avg ?? 0 }));
    return monthGoal(points, now.year(), now.month() + 1);
  }, [avgCheckData, monthlyRevenue]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        {screens.md ? (
          <Segmented<Period> value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        ) : (
          <Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} className={styles.periodSelect} />
        )}
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

      <GamePanel
        level={game.level}
        goal={game.revenueGoal ?? game.recordsGoal}
        goalKind={game.revenueGoal ? 'revenue' : 'records'}
        streak={game.streak}
        achievements={game.achievements}
        loading={loading && monthlyRecordCount.length === 0}
      />

      <div className={canSeeAvgCard ? styles.tiles4 : styles.tiles3}>
        <KpiTile
          tone="cyan"
          icon={<CheckCircleOutlined />}
          label="Закрытых сделок"
          value={summary?.closedCount ?? 0}
          deltaPct={monthDelta(game.recordsGoal)}
          spark={monthlyRecordCount.map(m => m.count)}
          loading={loading}
        />
        <KpiTile
          tone="lime"
          icon={<DollarOutlined />}
          label="Выручка"
          value={formatPrice(summary?.totalRevenue ?? 0)}
          deltaPct={monthDelta(game.revenueGoal)}
          spark={canSeeRevenue ? monthlyRevenue.map(m => m.amount) : undefined}
          loading={loading}
        />
        <KpiTile
          tone="amber"
          icon={<ThunderboltOutlined />}
          label="Средний чек"
          value={formatPrice(summary?.closedCount ? summary.totalRevenue / summary.closedCount : 0)}
          deltaPct={canSeeRevenue ? monthDelta(avgGoal) : null}
          spark={canSeeRevenue ? avgCheckData.map(m => m.avg) : undefined}
          loading={loading}
        />
        {canSeeAvgCard && (
          <KpiTile
            tone="violet"
            icon={<TrophyOutlined />}
            label="Ср. чек за всё время"
            value={formatPrice(overallAvg)}
            loading={loading}
          />
        )}
      </div>

      <div className={canSeeRevenue ? styles.chartsMain : styles.chartsSingle}>
        {canSeeRevenue && (
          <Panel kicker="Динамика" title="Выручка по месяцам" className={styles.revenuePanel}>
            <MonthlyLineChart<MonthlyRevenueItem>
              data={monthlyRevenue}
              hasData={monthlyRevenue.length > 1}
              xKey="labelShort"
              yKey="amount"
              tone="lime"
              height={screens.md ? 300 : 220}
              yWidth={44}
              yTickFormatter={formatThousands}
              renderTooltip={item => (
                <ChartTooltip label={item.label} name="Выручка" tone="lime" value={formatPrice(item.amount)} />
              )}
            />
          </Panel>
        )}
        <Panel kicker="За период" title="Топ услуг">
          <TopServicesDonut items={topServices} />
        </Panel>
      </div>

      {canSeeRevenue && (
        <div className={styles.chartsPair}>
          <Panel kicker="Загрузка" title="Записей по месяцам">
            <MonthlyLineChart<MonthlyRecordCountItem>
              data={monthlyRecordCount}
              hasData={monthlyRecordCount.length > 1}
              xKey="labelShort"
              yKey="count"
              tone="cyan"
              height={200}
              yWidth={32}
              renderTooltip={item => (
                <ChartTooltip label={item.label} name="Записей" tone="cyan" value={item.count} />
              )}
            />
          </Panel>
          <Panel kicker="Качество" title="Средний чек по месяцам">
            <MonthlyLineChart<AvgCheckItem>
              data={avgCheckData}
              hasData={avgCheckData.filter(r => r.avg > 0).length > 1}
              xKey="labelShort"
              yKey="avg"
              tone="amber"
              height={200}
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
          </Panel>
        </div>
      )}
    </div>
  );
};
