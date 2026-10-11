import React, { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import cn from 'classnames';
import { Tone, useChartColors } from '../useChartColors';
import styles from './MonthlyLineChart.module.scss';

interface Props<T> {
  data: T[];
  xKey: string;
  yKey: string;
  tone: Tone;
  height: number;
  yWidth: number;
  yTickFormatter?: (v: number) => string;
  renderTooltip: (item: T) => React.ReactNode;
  margin?: { top: number; right: number; left: number; bottom: number };
  /** Показывать ли график: иначе — заглушка «Нет данных» той же высоты */
  hasData: boolean;
  emptyText?: string;
}

const AXIS_TICK = { fontSize: 11 };

/**
 * Неоновый график по месяцам: светящаяся линия и заливка-градиент под ней.
 * Одинаковый для всех помесячных рядов дашборда.
 */
export function MonthlyLineChart<T>({
  data, xKey, yKey, tone, height, yWidth, yTickFormatter, renderTooltip, margin, hasData,
  emptyText = 'Нет данных',
}: Props<T>) {
  const colors = useChartColors();
  // id градиента и свечения уникальны для каждого графика на странице
  const uid = useId().replace(/:/g, '');
  const color = colors[tone];

  if (!hasData) {
    // Высота приходит пропсом — передаём её CSS-переменной
    return <div className={styles.empty} style={{ '--chart-height': `${height}px` } as React.CSSProperties}>{emptyText}</div>;
  }
  return (
    <div className={cn(styles.chart, styles[tone])}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={margin ?? { top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey={xKey} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ ...AXIS_TICK, fill: colors.axis }}
            tickFormatter={yTickFormatter}
            width={yWidth}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.4, strokeDasharray: '4 4' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return renderTooltip(payload[0].payload as T);
            }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#fill-${uid})`}
            dot={data.length <= 12 ? { r: 3, strokeWidth: 0, fill: color } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: colors.primary, fill: color }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
