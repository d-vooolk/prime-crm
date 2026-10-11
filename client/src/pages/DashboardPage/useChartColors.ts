import { useCssVars } from '@/hooks/useCssVars';

/** Неоновые серии дашборда — по порядку --color-chart-1..6 */
export type Tone = 'lime' | 'cyan' | 'amber' | 'violet' | 'pink' | 'sky';

export const TONES: readonly Tone[] = ['lime', 'cyan', 'amber', 'violet', 'pink', 'sky'];

const CHART_VARS = [
  '--color-chart-1', '--color-chart-2', '--color-chart-3', '--color-chart-4', '--color-chart-5', '--color-chart-6',
  '--color-chart-grid', '--color-chart-axis', '--color-primary',
] as const;

/** Цвета графиков дашборда из CSS-переменных — recharts нужны строки, а следовать они должны теме */
export function useChartColors() {
  const v = useCssVars(CHART_VARS);
  return {
    lime: v['--color-chart-1'],
    cyan: v['--color-chart-2'],
    amber: v['--color-chart-3'],
    violet: v['--color-chart-4'],
    pink: v['--color-chart-5'],
    sky: v['--color-chart-6'],
    grid: v['--color-chart-grid'],
    axis: v['--color-chart-axis'],
    primary: v['--color-primary'],
  };
}

export type ChartColors = ReturnType<typeof useChartColors>;
