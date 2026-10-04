import { useCssVars } from '@/hooks/useCssVars';

const CHART_VARS = ['--color-chart-1', '--color-chart-2', '--color-chart-3', '--color-chart-grid', '--color-primary'] as const;

/** Цвета графиков дашборда из CSS-переменных — recharts нужны строки, а следовать они должны теме */
export function useChartColors() {
  const v = useCssVars(CHART_VARS);
  return {
    blue: v['--color-chart-1'],
    green: v['--color-chart-2'],
    amber: v['--color-chart-3'],
    grid: v['--color-chart-grid'],
    primary: v['--color-primary'],
  };
}
