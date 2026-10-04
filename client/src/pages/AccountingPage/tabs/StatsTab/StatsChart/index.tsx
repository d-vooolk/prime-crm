import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPrice } from '@/utils/formatters';
import { useCssVars } from '@/hooks/useCssVars';
import { StatsChartPoint } from '../../../utils';
import styles from './StatsChart.module.scss';

interface Props {
  data: StatsChartPoint[];
}

const CHART_VARS = ['--color-chart-grid', '--color-primary', '--color-chart-1', '--color-chart-3'] as const;

/** Выручка (левая ось), количество записей (правая) и средний чек по месяцам */
export const StatsChart: React.FC<Props> = ({ data }) => {
  const colors = useCssVars(CHART_VARS);
  const dot = data.length <= 12;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors['--color-chart-grid']} />
        <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="revenue" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} width={44} />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} width={32} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className={styles.tooltip}>
                <div className={styles.tooltipLabel}>{label}</div>
                {payload.map(p => (
                  <div key={p.dataKey as string}>
                    {p.dataKey === 'amount'
                      ? <>Выручка: <strong className={styles.revenue}>{formatPrice(p.value as number)}</strong></>
                      : p.dataKey === 'count'
                        ? <>Записей: <strong className={styles.count}>{p.value}</strong></>
                        : <>Средний чек: <strong className={styles.avg}>{formatPrice(p.value as number)}</strong></>}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Line yAxisId="revenue" type="monotone" dataKey="amount" name="Выручка" stroke={colors['--color-primary']} strokeWidth={2} dot={dot} activeDot={{ r: 4 }} />
        <Line yAxisId="count" type="monotone" dataKey="count" name="Записей" stroke={colors['--color-chart-1']} strokeWidth={2} dot={dot} activeDot={{ r: 4 }} strokeDasharray="5 3" />
        <Line yAxisId="revenue" type="monotone" dataKey="avg" name="Средний чек" stroke={colors['--color-chart-3']} strokeWidth={2} dot={dot} activeDot={{ r: 4 }} strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
};
