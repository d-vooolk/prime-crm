/**
 * Масштаб интерфейса на компьютере. Вёрстка рассчитана на монитор 2560 px: на 1920×1080
 * при 100% всё крупное, и приходилось уменьшать масштаб браузера до 65–75%. Теперь это
 * делает сама CRM через CSS zoom на <html>: «Авто» сжимает интерфейс по ширине монитора
 * (1920 → 75%, 2560 и шире — 100%), либо масштаб выбирают вручную в настройках.
 *
 * Телефоны, планшеты и ноутбуки с узким экраном (меньше 1700 px) «Авто» не трогает.
 * Под zoom высота в vh тоже уменьшается — поэтому полноэкранные блоки считаются
 * как calc(100dvh / var(--app-zoom)).
 */
export type UiScale = 'auto' | number;

export const UI_SCALE_OPTIONS = [1, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65];

const DESIGN_WIDTH = 2560;
const AUTO_MIN_SCREEN = 1700;
const MIN_SCALE = 0.65;

/** «Авто» для монитора шириной screenWidth (в CSS-пикселях, с учётом масштаба Windows) */
export function autoScale(screenWidth: number): number {
  if (screenWidth < AUTO_MIN_SCREEN || screenWidth >= DESIGN_WIDTH) return 1;
  return Math.max(MIN_SCALE, Math.round((screenWidth / DESIGN_WIDTH) * 100) / 100);
}

export function effectiveScale(scale: UiScale, screenWidth: number): number {
  return scale === 'auto' ? autoScale(screenWidth) : scale;
}

export function applyUiScale(scale: UiScale) {
  const value = effectiveScale(scale, window.screen.width);
  const root = document.documentElement;
  root.style.zoom = value === 1 ? '' : String(value);
  root.style.setProperty('--app-zoom', String(value));
}
