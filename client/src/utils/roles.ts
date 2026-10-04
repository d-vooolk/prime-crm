/**
 * Роли пользователей и права. Все проверки ролей — только через этот модуль,
 * чтобы строки ролей не расползались по компонентам.
 * isMaster — суперпользователь, ему разрешено всё.
 */

export const ROLES = {
  CREATOR: 'Создатель',
  DIRECTOR: 'Директор',
  MANAGER: 'Менеджер',
  EMPLOYEE: 'Сотрудник',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/** Порядок важен: используется в выпадающем списке ролей */
export const ALL_ROLES: string[] = [ROLES.CREATOR, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.EMPLOYEE];
export const MANAGER_ROLES: string[] = [ROLES.CREATOR, ROLES.DIRECTOR, ROLES.MANAGER];
export const DIRECTOR_ROLES: string[] = [ROLES.CREATOR, ROLES.DIRECTOR];
export const CREATOR_ROLES: string[] = [ROLES.CREATOR];

/** Создателя нельзя уволить */
export const UNDISMISSABLE_ROLE: string = ROLES.CREATOR;

/** Минимум полей пользователя для проверки прав (подходит и AuthUser, и Serviceman) */
export interface RoleSubject {
  role?: string | null;
  isMaster?: boolean;
}

type Subject = RoleSubject | null | undefined;

const hasRole = (u: Subject, roles: string[]) => roles.includes(u?.role || '');

export const isEmployee = (u: Subject) => u?.role === ROLES.EMPLOYEE;
export const isManagerRole = (role?: string | null) => MANAGER_ROLES.includes(role || '');
export const isDirectorRole = (role?: string | null) => DIRECTOR_ROLES.includes(role || '');

/** Мастер, Создатель, Директор или Менеджер */
export const isManagerOrAbove = (u: Subject) => !!u?.isMaster || hasRole(u, MANAGER_ROLES);
/** Мастер, Создатель или Директор */
export const isDirectorOrAbove = (u: Subject) => !!u?.isMaster || hasRole(u, DIRECTOR_ROLES);
/** Мастер или Создатель */
export const isCreatorOrAbove = (u: Subject) => !!u?.isMaster || hasRole(u, CREATOR_ROLES);

// ─── Бухгалтерия ───────────────────────────────────
export const canSeeCashflow = isManagerOrAbove;
export const canSeeCapital = isDirectorOrAbove;
export const canEditTransactions = isCreatorOrAbove;
export const canSeeClientName = isManagerOrAbove;

// ─── Дашборд ───────────────────────────────────────
export const canSeeRevenue = isDirectorOrAbove;
export const canSeeExpenses = isCreatorOrAbove;
export const canSeeAvgCard = isManagerOrAbove;

// ─── Записи ────────────────────────────────────────
/** Удалять запись может только мастер или Создатель (не путать с canEditTransactions — совпадает случайно) */
export const canDeleteRecord = (u: Subject) => !!u?.isMaster || u?.role === ROLES.CREATOR;

// ─── Заметки ───────────────────────────────────────
export const isNotesCreator = isCreatorOrAbove;
/** Править заметку: Создатель/мастер, автор заметки или любой руководитель */
export const canEditNote = (u: (RoleSubject & { id?: string }) | null | undefined, authorId?: string | null) =>
  isCreatorOrAbove(u) || (!!authorId && authorId === u?.id) || hasRole(u, MANAGER_ROLES);

// ─── Вики ──────────────────────────────────────────
export const WIKI_REVIEWER_ROLES = MANAGER_ROLES;
export const isWikiReviewer = (u: Subject) => !!u && isManagerOrAbove(u);

// ─── Навигация ─────────────────────────────────────
/** Сотруднику доступны только эти разделы */
export const EMPLOYEE_ALLOWED_PATHS = ['/schedule', '/wiki', '/accounting', '/settings'];
export const canSeePath = (u: Subject, path: string) => !isEmployee(u) || EMPLOYEE_ALLOWED_PATHS.includes(path);

// ─── Уровни ролей (справочник сотрудников) ─────────
const ROLE_LEVEL: Record<string, number> = {
  [ROLES.CREATOR]: 1, [ROLES.DIRECTOR]: 2, [ROLES.MANAGER]: 3, [ROLES.EMPLOYEE]: 4,
};

/** Чем меньше число, тем выше роль. Без роли — ниже всех. */
export function getRoleLevel(role?: string | null): number {
  if (!role) return 99;
  return ROLE_LEVEL[role] ?? 99;
}

/** Уровень текущего пользователя: мастер — 0, выше всех ролей */
export const getUserLevel = (u: Subject) => (u?.isMaster ? 0 : getRoleLevel(u?.role));

/** Редактировать сотрудника можно, если его роль не выше своей */
export const canEditServicemanRole = (u: Subject, targetRole?: string | null) => {
  const my = getUserLevel(u);
  return my === 0 || getRoleLevel(targetRole) >= my;
};

/** Роли, которые пользователь может назначать */
export const getAssignableRoles = (u: Subject) => {
  const my = getUserLevel(u);
  return my === 0 ? ALL_ROLES : ALL_ROLES.filter(r => ROLE_LEVEL[r] >= my);
};
