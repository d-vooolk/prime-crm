/**
 * На сенсорном экране подсказка графика — по нажатию: с 'hover' recharts ловит каждое движение
 * пальца над графиком и перерисовывает подсказку прямо во время прокрутки страницы.
 */
export const chartTooltipTrigger: 'hover' | 'click' =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'click' : 'hover';
