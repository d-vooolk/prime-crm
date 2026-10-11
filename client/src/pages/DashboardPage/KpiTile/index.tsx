import React, { useId, useMemo } from 'react';
import cn from 'classnames';
import { Skeleton } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Tone, useChartColors } from '../useChartColors';
import styles from './KpiTile.module.scss';

interface Props {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Изменение к прошлому месяцу, %; null — не показываем */
  deltaPct?: number | null;
  /** Помесячный ряд для спарклайна (от старых к новым) */
  spark?: number[];
  loading?: boolean;
}

/** Плитка показателя: неоновая иконка, крупное число, изменение к прошлому месяцу и спарклайн */
export const KpiTile: React.FC<Props> = ({ tone, icon, label, value, deltaPct, spark, loading }) => {
  const colors = useChartColors();
  const uid = useId().replace(/:/g, '');
  const sparkData = useMemo(() => (spark ?? []).slice(-12).map((v, i) => ({ i, v })), [spark]);
  const color = colors[tone];

  return (
    <div className={cn(styles.tile, styles[tone])}>
      <div className={styles.head}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.label}>{label}</span>
      </div>
      {loading ? (
        <Skeleton active title={false} paragraph={{ rows: 1, width: '70%' }} />
      ) : (
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {deltaPct != null && Number.isFinite(deltaPct) && (
            <span
              className={cn(styles.delta, deltaPct >= 0 ? styles.up : styles.down)}
              title="К прошлому месяцу"
            >
              {deltaPct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              {Math.abs(Math.round(deltaPct))}%
            </span>
          )}
        </div>
      )}
      {sparkData.length > 1 && (
        <div className={styles.spark}>
          <ResponsiveContainer width="100%" height={44}>
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#spark-${uid})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
