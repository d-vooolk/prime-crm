import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import { formatPrice } from '@/utils/formatters';
import styles from './DealCelebration.module.scss';

interface Props {
  /** Итог сделки — считается от нуля, пока рисуется галочка */
  amount: number;
  /** «BMW X5» — подпись под суммой */
  caption?: string;
  onDone: () => void;
}

// Лучи-«световые полосы» вокруг кольца
const RAYS = 16;
const COUNT_UP_MS = 900;
const COUNT_UP_DELAY_MS = 350;

/** Сумма от 0 до amount с замедлением к концу */
function useCountUp(amount: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(amount);
      return;
    }
    let frame = 0;
    const start = performance.now() + COUNT_UP_DELAY_MS;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_UP_MS));
      setValue(amount * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);

  return value;
}

/**
 * Закрытие сделки: кольцо и галочка прорисовываются салатовым неоном, от них расходится волна
 * и световые лучи, сумма сделки «набегает» от нуля. ~2 секунды, нажатия не перехватывает.
 */
export const DealCelebration: React.FC<Props> = ({ amount, caption, onDone }) => {
  const [exiting, setExiting] = useState(false);
  const shown = useCountUp(amount);
  // onDone приходит новой стрелкой на каждой перерисовке родителя — таймеры от этого не перезапускаются
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 1650);
    const doneTimer = setTimeout(() => onDoneRef.current(), 2050);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, []);

  return createPortal(
    <div className={cn(styles.overlay, exiting ? styles.exit : styles.enter)} role="status" aria-live="polite">
      <div className={styles.beam} />
      <div className={styles.stage}>
        <div className={styles.emblem}>
          <span className={styles.wave} />
          <span className={cn(styles.wave, styles.waveLate)} />
          {Array.from({ length: RAYS }, (_, i) => (
            <span
              key={i}
              className={styles.ray}
              // Угол луча — единственное, что отличает лучи; оформление в .ray
              style={{ '--ray-angle': `${(360 / RAYS) * i}deg`, '--ray-delay': `${0.42 + (i % 4) * 0.03}s` } as React.CSSProperties}
            />
          ))}
          <svg className={styles.mark} viewBox="0 0 120 120" aria-hidden="true">
            <circle className={styles.track} cx="60" cy="60" r="52" />
            <circle className={styles.ring} cx="60" cy="60" r="52" pathLength={1} />
            <path className={styles.check} d="M38 61.5l15 15 30-32" pathLength={1} />
          </svg>
        </div>

        <div className={styles.label}>Сделка закрыта</div>
        <div className={styles.amount}>{formatPrice(Math.round(shown))}</div>
        {caption && <div className={styles.caption}>{caption}</div>}
      </div>
    </div>,
    document.body,
  );
};
