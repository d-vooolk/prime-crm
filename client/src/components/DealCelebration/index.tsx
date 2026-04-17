import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styles from './DealCelebration.module.scss';

interface Props {
  onDone: () => void;
}

const COLORS = [
  '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b',
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c',
  '#fff', '#86efac',
];

const COUNT = 60;

export const DealCelebration: React.FC<Props> = ({ onDone }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 1600);
    const doneTimer = setTimeout(onDone, 2000);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  const particles = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      angle: (i / COUNT) * 360 + (Math.random() - 0.5) * (360 / COUNT),
      dist: 220 + Math.random() * 380,
      color: COLORS[i % COLORS.length],
      size: 10 + Math.random() * 16,
      dur: 0.9 + Math.random() * 0.6,
      delay: Math.random() * 0.12,
    })), []);

  return createPortal(
    <div className={`${styles.overlay} ${exiting ? styles.exit : styles.enter}`}>
      <div className={styles.center}>
        {particles.map(p => (
          <div
            key={p.id}
            className={styles.particle}
            style={{
              '--angle': `${p.angle}deg`,
              '--dist': `${p.dist}px`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
            } as React.CSSProperties}
          />
        ))}
        <div className={styles.text}>Сделка закрыта</div>
      </div>
    </div>,
    document.body
  );
};
