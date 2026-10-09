/**
 * Сдвиг экрана на iOS после клавиатуры.
 *
 * iOS 26 (и часть более ранних) после закрытия клавиатуры не возвращает visualViewport.offsetTop
 * в ноль. Документ при этом не прокручен (body зафиксирован, window.scrollY = 0), но фиксированные
 * элементы рисуются выше своего места: модалка уезжает под статус-бар, а нажатия в выпадающих
 * списках срабатывают со смещением (жмёшь 2025 — выбирается 2026). На разных моделях и версиях
 * iOS проявляется по-разному, поэтому сбрасываем сдвиг сами, как только клавиатура закрылась.
 */

/** Описание сфокусированного элемента — чтобы логику можно было проверить без DOM */
export interface FocusedField {
  tag: string;
  type?: string;
  readOnly?: boolean;
  contentEditable?: boolean;
}

// Поля input, которые не вызывают клавиатуру
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

/**
 * Открывает ли элемент экранную клавиатуру. Поле выбора antd без поиска — это input с readOnly:
 * фокус уходит в него, а клавиатура закрывается, поэтому «полем ввода» его не считаем.
 */
export function opensKeyboard(field: FocusedField | null): boolean {
  if (!field) return false;
  if (field.contentEditable) return true;
  const tag = field.tag.toUpperCase();
  if (tag === 'TEXTAREA') return !field.readOnly;
  if (tag !== 'INPUT') return false;
  return !field.readOnly && !NON_TEXT_INPUT_TYPES.has((field.type ?? 'text').toLowerCase());
}

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  /** visualViewport.offsetTop / offsetLeft; нет visualViewport — 0 */
  offsetTop: number;
  offsetLeft: number;
}

/** Экран сдвинут относительно своего места (меньше пикселя — погрешность округления) */
export function isViewportShifted(v: ViewportState): boolean {
  return Math.abs(v.scrollX) >= 1 || Math.abs(v.scrollY) >= 1
    || Math.abs(v.offsetTop) >= 1 || Math.abs(v.offsetLeft) >= 1;
}

function fieldOf(el: Element | null): FocusedField | null {
  if (!el) return null;
  return {
    tag: el.tagName,
    type: el instanceof HTMLInputElement ? el.type : undefined,
    readOnly: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.readOnly : undefined,
    contentEditable: el instanceof HTMLElement && el.isContentEditable,
  };
}

function currentState(): ViewportState {
  const vv = window.visualViewport;
  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
  };
}

/** Клавиатура сейчас нужна — сдвиг экрана под неё не трогаем */
export const isTyping = () => opensKeyboard(fieldOf(document.activeElement));

/**
 * Вернуть экран на место. scrollTo(0, 0) при window.scrollY = 0 iOS может проигнорировать,
 * поэтому, если сдвиг остался, «толкаем» прокрутку на пиксель туда и обратно — после этого
 * WebKit пересчитывает visualViewport. Обёртки модалок antd тоже возвращаем наверх:
 * iOS прокручивает их к полю даже при overflow: hidden, и заголовок с крестиком уезжает.
 */
export function resetViewportShift() {
  document.querySelectorAll<HTMLElement>('.ant-modal-wrap').forEach(wrap => {
    if (wrap.scrollTop) wrap.scrollTop = 0;
  });
  if (!isViewportShifted(currentState())) return;
  window.scrollTo(0, 0);
  if (isViewportShifted(currentState())) {
    window.scrollBy(0, 1);
    window.scrollBy(0, -1);
  }
}

/**
 * Следить за клавиатурой и сбрасывать сдвиг, когда она закрылась: по уходу фокуса из поля
 * и по изменению visualViewport. Возвращает функцию отписки.
 */
export function watchViewportShift(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Ждём, пока клавиатура уедет, и не мешаем, если фокус сразу ушёл в соседнее поле
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!isTyping()) resetViewportShift();
    }, 300);
  };

  const vv = window.visualViewport;
  document.addEventListener('focusout', schedule);
  vv?.addEventListener('resize', schedule);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('focusout', schedule);
    vv?.removeEventListener('resize', schedule);
  };
}
