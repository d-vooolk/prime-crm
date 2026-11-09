import React, { useEffect, useRef } from 'react';
import cn from 'classnames';
import styles from './ScrollTabBar.module.scss';

interface TabItem {
  key: string;
  label: React.ReactNode;
}

interface Props {
  items: TabItem[];
  activeKey: string | undefined;
  onChange: (key: string) => void;
}

/**
 * Полоса вкладок с обычной прокруткой браузера (подставляется в antd Tabs через renderTabBar).
 * Стандартная панель antd вешает на весь документ неотменяемый touchmove и перерисовывается
 * на каждое движение пальца по шапке — на телефоне прокрутка страницы у её верха дёргалась.
 */
export const ScrollTabBar: React.FC<Props> = ({ items, activeKey, onChange }) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Выбранная вкладка (в т.ч. открытая ссылкой) — в видимой части полосы
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  return (
    <div className={styles.bar} role="tablist">
      {items.map(item => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(styles.tab, { [styles.active]: active })}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
