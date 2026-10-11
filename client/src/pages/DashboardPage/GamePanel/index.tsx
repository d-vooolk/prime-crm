import React from 'react';
import cn from 'classnames';
import { Skeleton, Tooltip } from 'antd';
import { FireOutlined, LockOutlined, RocketOutlined, TrophyOutlined } from '@ant-design/icons';
import { formatPrice } from '@/utils/formatters';
import type { Achievement, LevelInfo, MonthGoal } from '../gamification';
import { NeonRing } from '../NeonRing';
import styles from './GamePanel.module.scss';

interface Props {
  level: LevelInfo;
  /** Цель месяца: по выручке, если роль её видит, иначе по числу записей */
  goal: MonthGoal;
  goalKind: 'revenue' | 'records';
  streak: number;
  achievements: Achievement[];
  loading: boolean;
}

const plural = (n: number, forms: [string, string, string]) => {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
};

/** Игровая панель: уровень мастерской, цель месяца (побить рекорд), серия роста и достижения */
export const GamePanel: React.FC<Props> = ({ level, goal, goalKind, streak, achievements, loading }) => {
  const fmt = (v: number) => (goalKind === 'revenue' ? formatPrice(v) : String(Math.round(v)));
  const left = Math.max(0, goal.best - goal.current);
  const unlocked = achievements.filter(a => a.unlocked).length;
  const streakSubject = goalKind === 'revenue' ? 'выручка' : 'записей';

  if (loading) {
    return (
      <div className={styles.panel}>
        <Skeleton active avatar paragraph={{ rows: 3 }} />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.grid}>
        {/* Уровень */}
        <div className={styles.block}>
          <NeonRing value={level.progress} tone="lime">
            <span className={styles.ringCaption}>Уровень</span>
            <span className={styles.ringValue}>{level.level}</span>
          </NeonRing>
          <div className={styles.blockText}>
            <div className={styles.kicker}>Мастерская</div>
            <div className={styles.headline}>{level.title}</div>
            <div className={styles.xp}>
              <div className={styles.xpBar}>
                {/* Заполнение — данные, через CSS-переменную */}
                <span style={{ '--xp': `${Math.round(level.progress * 100)}%` } as React.CSSProperties} />
              </div>
              <div className={styles.muted}>
                {level.earned} / {level.needed} {plural(level.needed, ['запись', 'записи', 'записей'])} до {level.level + 1} ур.
              </div>
            </div>
          </div>
        </div>

        {/* Цель месяца */}
        <div className={styles.block}>
          <NeonRing value={goal.progress} tone={goal.isRecord ? 'lime' : 'cyan'}>
            <span className={styles.ringValue}>{Math.round(goal.progress * 100)}%</span>
            <span className={styles.ringCaption}>рекорда</span>
          </NeonRing>
          <div className={styles.blockText}>
            <div className={styles.kicker}>
              Цель месяца · {goalKind === 'revenue' ? 'выручка' : 'записи'}
            </div>
            <div className={styles.headline}>{fmt(goal.current)}</div>
            {goal.isRecord ? (
              <span className={styles.recordBadge}><RocketOutlined /> Новый рекорд!</span>
            ) : goal.best > 0 ? (
              <div className={styles.muted}>
                Рекорд {fmt(goal.best)} · осталось <b className={styles.strong}>{fmt(left)}</b>
              </div>
            ) : (
              <div className={styles.muted}>Первый месяц — рекорд впереди</div>
            )}
          </div>
        </div>

        {/* Серия роста */}
        <div className={styles.block}>
          <div className={cn(styles.flame, { [styles.flameActive]: streak > 0 })}>
            <FireOutlined />
            <span className={styles.flameCount}>{streak}</span>
          </div>
          <div className={styles.blockText}>
            <div className={styles.kicker}>Серия роста</div>
            <div className={styles.headline}>
              {streak} {plural(streak, ['месяц', 'месяца', 'месяцев'])}
            </div>
            <div className={styles.muted}>
              {streak > 0
                ? `Подряд ${streakSubject} больше, чем месяцем раньше`
                : 'Закончите месяц лучше прошлого — серия начнётся'}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.achievementsHead}>
        <span className={styles.kicker}>Достижения</span>
        <span className={styles.muted}>{unlocked} из {achievements.length}</span>
      </div>
      <div className={styles.achievements}>
        {achievements.map(a => (
          <Tooltip key={a.id} title={a.description}>
            <div className={cn(styles.badge, { [styles.badgeUnlocked]: a.unlocked })}>
              <span className={styles.badgeIcon}>{a.unlocked ? <TrophyOutlined /> : <LockOutlined />}</span>
              <span className={styles.badgeText}>
                <span className={styles.badgeTitle}>{a.title}</span>
                {!a.unlocked && (
                  <span className={styles.badgeBar}>
                    <span style={{ '--xp': `${Math.round(a.progress * 100)}%` } as React.CSSProperties} />
                  </span>
                )}
              </span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
