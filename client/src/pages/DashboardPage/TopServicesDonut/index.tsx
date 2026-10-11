import React, { useId, useMemo } from 'react';
import cn from 'classnames';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopServiceItem } from '../hooks';
import { TONES, useChartColors } from '../useChartColors';
import { ChartTooltip } from '../ChartTooltip';
import styles from './TopServicesDonut.module.scss';

interface Props {
  items: TopServiceItem[];
}

// Цветов шесть — остальное складывается в «Другие» (нейтральным цветом)
const MAX_SLICES = 5;

interface Slice {
  name: string;
  count: number;
  /** Индекс цвета серии; null — «Другие» */
  toneIndex: number | null;
}

/** Топ услуг за период: неоновая кольцевая диаграмма и легенда с долями */
export const TopServicesDonut: React.FC<Props> = ({ items }) => {
  const colors = useChartColors();
  const glowId = `donut-glow-${useId().replace(/:/g, '')}`;

  const slices = useMemo<Slice[]>(() => {
    const sorted = [...items].sort((a, b) => b.count - a.count);
    const head = sorted.slice(0, MAX_SLICES).map((s, i) => ({ name: s.service.name, count: s.count, toneIndex: i }));
    const restCount = sorted.slice(MAX_SLICES).reduce((sum, s) => sum + s.count, 0);
    return restCount > 0 ? [...head, { name: 'Другие', count: restCount, toneIndex: null }] : head;
  }, [items]);

  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <div className={styles.empty}>Нет данных</div>;

  const colorOf = (s: Slice) => (s.toneIndex == null ? colors.axis : colors[TONES[s.toneIndex]]);

  return (
    <div className={styles.wrap}>
      <div className={styles.donut}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Свечение цветом самого сегмента: размытая копия под ним */}
            <defs>
              <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="name"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              animationDuration={900}
            >
              {slices.map(s => <Cell key={s.name} fill={colorOf(s)} filter={`url(#${glowId})`} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as Slice;
                return (
                  <ChartTooltip
                    label={s.name}
                    name="Раз"
                    tone={s.toneIndex == null ? 'sky' : TONES[s.toneIndex]}
                    value={s.count}
                    hint={`${Math.round((s.count / total) * 100)}% от топа`}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.center}>
          <span className={styles.total}>{total}</span>
          <span className={styles.caption}>услуг</span>
        </div>
      </div>

      <ul className={styles.legend}>
        {slices.map(s => (
          <li key={s.name} className={styles.item}>
            <span className={cn(styles.dot, s.toneIndex == null ? styles.other : styles[TONES[s.toneIndex]])} />
            <span className={styles.name}>{s.name}</span>
            <span className={styles.count}>{s.count}</span>
            <span className={styles.share}>{Math.round((s.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
