import { useMemo } from 'react';
import { useUiStore } from '@/store/uiStore';

/**
 * Значения CSS-переменных для мест, где нужен цвет строкой (props recharts).
 * Пересчитывается при смене темы, поэтому графики следуют светлой/тёмной теме.
 */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const theme = useUiStore(s => s.theme);
  const key = names.join('|');

  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(n => [n, style.getPropertyValue(n).trim()])) as Record<K, string>;
    // names сравниваем по содержимому (key), а theme — триггер пересчёта после смены data-theme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, theme]);
}
