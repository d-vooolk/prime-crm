/** Сколько пунктов помещается в нижнюю панель телефона рядом с «Ещё» */
export const BOTTOM_NAV_MAX = 5;

/** Без своего выбора эти разделы уходят в «Ещё» (как было до настройки) */
export const DEFAULT_MORE_PATHS = ['/leads', '/mail', '/settings'];

/**
 * Какие разделы показать в нижней панели. visible — доступные пользователю (порядок меню),
 * chosen — его выбор в настройках. Выбор мог устареть (роль сменилась, раздел скрыт) —
 * берём только доступные; если не осталось ни одного, — набор по умолчанию
 */
export function bottomNavPaths(visible: string[], chosen?: string[] | null): string[] {
  const picked = chosen ? visible.filter(p => chosen.includes(p)) : [];
  const paths = picked.length ? picked : visible.filter(p => !DEFAULT_MORE_PATHS.includes(p));
  return paths.slice(0, BOTTOM_NAV_MAX);
}
