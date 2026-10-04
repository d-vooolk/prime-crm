import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './MonthlyLineChart.module.scss';

interface Props<T> {
  data: T[];
  xKey: string;
  yKey: string;
  /** Цвет линии строкой (из useChartColors) */
  color: string;
  gridColor: string;
  height: number;
  yWidth: number;
  yTickFormatter?: (v: number) => string;
  renderTooltip: (item: T) => React.ReactNode;
  margin?: { top: number; right: number; left: number; bottom: number };
  /** Показывать ли график: иначе — заглушка «Нет данных» (высота графиков в карточках — 160) */
  hasData: boolean;
  emptyText?: string;
}

/** Линейный график по месяцам с сеткой и подсказкой — одинаковый для всех рядов дашборда */
export function MonthlyLineChart<T>({
  data, xKey, yKey, color, gridColor, height, yWidth, yTickFormatter, renderTooltip, margin, hasData,
  emptyText = 'Нет данных',
}: Props<T>) {
  if (!hasData) {
    return <div className={styles.empty}>{emptyText}</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} width={yWidth} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return renderTooltip(payload[0].payload as T);
          }}
        />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={data.length <= 12} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
