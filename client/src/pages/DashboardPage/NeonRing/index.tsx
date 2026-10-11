import React from 'react';
import cn from 'classnames';
import type { Tone } from '../useChartColors';
import styles from './NeonRing.module.scss';

interface Props {
  /** 0..1 */
  value: number;
  tone: Tone;
  /** Диаметр, px: малое кольцо (72) в плитках, большое (132) — уровень и цель месяца */
  size?: 'sm' | 'lg';
  children?: React.ReactNode;
}

/** Кольцо прогресса с неоновым свечением; заполняется анимацией при появлении */
export const NeonRing: React.FC<Props> = ({ value, tone, size = 'lg', children }) => {
  const clamped = Math.min(1, Math.max(0, value || 0));
  return (
    <div className={cn(styles.ring, styles[size], styles[tone])}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {/* Деления по кругу — «приборная» шкала */}
        <circle className={styles.ticks} cx="60" cy="60" r="56" pathLength={60} />
        <circle className={styles.track} cx="60" cy="60" r="47" />
        <circle
          className={styles.bar}
          cx="60"
          cy="60"
          r="47"
          pathLength={100}
          // Доля заполнения — данные, поэтому через CSS-переменную
          style={{ '--ring-offset': 100 - clamped * 100 } as React.CSSProperties}
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
};
