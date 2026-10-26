/**
 * Жесты в просмотре фото antd (Image / Image.PreviewGroup) — во всём приложении сразу:
 * свайп вверх или вниз закрывает просмотр, влево / вправо — листает фото.
 *
 * antd этого не умеет, поэтому слушаем касания на window в фазе захвата (до обработчиков
 * rc-image) и нажимаем его же кнопки: закрыть и стрелки. Пока фото увеличено щипком,
 * жесты не трогаем — пальцем фото двигают.
 */

export type SwipeAction = 'close' | 'prev' | 'next' | null;

export interface SwipeMove {
  dx: number;
  dy: number;
  /** Длительность жеста, мс */
  dt: number;
}

/** Сколько пикселей нужно провести, чтобы листнуть */
const SWITCH_DISTANCE = 60;
/** Сколько — чтобы закрыть */
const CLOSE_DISTANCE = 90;
/** Быстрый взмах засчитывается и с половины расстояния, px/мс */
const FLICK_SPEED = 0.5;

/** Что сделать по итогам жеста. Направление — по преобладающей оси */
export function swipeAction({ dx, dy, dt }: SwipeMove): SwipeAction {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const flick = dt > 0 && Math.max(ax, ay) / dt >= FLICK_SPEED;
  const passed = (distance: number, need: number) => distance >= need || (flick && distance >= need / 2);

  if (ay > ax) return passed(ay, CLOSE_DISTANCE) ? 'close' : null;
  if (ax > ay && passed(ax, SWITCH_DISTANCE)) return dx < 0 ? 'next' : 'prev';
  return null;
}

/** Затемнение фона, пока фото тянут к закрытию: 1 → 0.3 */
export function maskOpacity(dy: number): number {
  return 1 - Math.min(Math.abs(dy) / 300, 0.7);
}

const PREFIX = 'ant-image-preview';

/** Последний (верхний) из открытых просмотров */
function lastOf<T extends Element>(selector: string): T | null {
  const all = document.querySelectorAll<T>(selector);
  return all.length ? all[all.length - 1] : null;
}

/** Фото увеличено щипком или кнопкой — тогда палец двигает фото, а не листает */
function isZoomed(img: HTMLElement | null): boolean {
  if (!img || !img.offsetWidth || !img.offsetHeight) return false;
  const rect = img.getBoundingClientRect();
  // Площадь не зависит от поворота на 90°
  const scale = Math.sqrt((rect.width * rect.height) / (img.offsetWidth * img.offsetHeight));
  return scale > 1.05;
}

export function installImagePreviewSwipe(): () => void {
  let start: { x: number; y: number; t: number } | null = null;
  let last = { x: 0, y: 0 };
  let mask: HTMLElement | null = null;

  const reset = () => {
    if (mask) mask.style.opacity = '';
    start = null;
    mask = null;
  };

  const onStart = (e: TouchEvent) => {
    reset();
    const wrap = (e.target as Element | null)?.closest?.(`.${PREFIX}-wrap`);
    if (!wrap || e.touches.length !== 1) return;
    if (isZoomed(wrap.querySelector<HTMLElement>(`.${PREFIX}-img`))) return;
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, t: performance.now() };
    last = { x: t.clientX, y: t.clientY };
    mask = lastOf<HTMLElement>(`.${PREFIX}-mask`);
  };

  const onMove = (e: TouchEvent) => {
    if (!start) return;
    // Второй палец — это щипок, не свайп
    if (e.touches.length !== 1) { reset(); return; }
    const t = e.touches[0];
    last = { x: t.clientX, y: t.clientY };
    const dx = last.x - start.x;
    const dy = last.y - start.y;
    if (mask) mask.style.opacity = Math.abs(dy) > Math.abs(dx) ? String(maskOpacity(dy)) : '';
  };

  const onEnd = () => {
    if (!start) return;
    const action = swipeAction({ dx: last.x - start.x, dy: last.y - start.y, dt: performance.now() - start.t });
    reset();
    if (!action) return;
    const selector = action === 'close'
      ? `.${PREFIX}-close`
      : `.${PREFIX}-switch-${action === 'prev' ? 'left' : 'right'}:not(.${PREFIX}-switch-${action === 'prev' ? 'left' : 'right'}-disabled)`;
    // После своего touchend rc-image возвращает фото на место — жмём кнопку следом
    setTimeout(() => lastOf<HTMLElement>(selector)?.click(), 0);
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('touchstart', onStart, opts);
  window.addEventListener('touchmove', onMove, opts);
  window.addEventListener('touchend', onEnd, opts);
  window.addEventListener('touchcancel', reset, opts);
  return () => {
    window.removeEventListener('touchstart', onStart, opts);
    window.removeEventListener('touchmove', onMove, opts);
    window.removeEventListener('touchend', onEnd, opts);
    window.removeEventListener('touchcancel', reset, opts);
  };
}
