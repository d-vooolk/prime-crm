import React from 'react';
import { Card } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SalaryHistoryItem } from '@/api/accounting.api';
import { formatPrice } from '@/utils/formatters';
import { useCssVars } from '@/hooks/useCssVars';
import styles from './SalaryChart.module.scss';

interface Props {
  history: SalaryHistoryItem[];
  loading: boolean;
}

const CHART_VARS = ['--color-chart-grid', '--color-primary'] as const;

/** Динамика заработка сотрудника по месяцам */
export const SalaryChart: React.FC<Props> = ({ history, loading }) => {
  const colors = useCssVars(CHART_VARS);

  return (
    <Card size="small" title="Динамика заработка по месяцам" loading={loading} className={styles.card}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors['--color-chart-grid']} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} width={40} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as SalaryHistoryItem;
              return (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipLabel}>{label}</div>
                  <div>Заработок: <strong className={styles.earned}>{formatPrice(item.adjustedTotal)}</strong></div>
                  <div className={styles.muted}>Машин: {item.recordCount}</div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="adjustedTotal"
            stroke={colors['--color-primary']}
            strokeWidth={2}
            dot={history.length <= 12}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
