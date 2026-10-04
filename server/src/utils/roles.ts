import type { AuthPayload } from '../middleware/auth.middleware';

/**
 * Роли и уровни доступа. Чем меньше уровень, тем больше прав; мастер-доступ — уровень 0.
 * Права на сервере повторяют то, что каждая роль видит в интерфейсе (client/src/utils/roles.ts):
 *  - Сотрудник — расписание, вики, своя зарплата;
 *  - Менеджер — плюс записи, справочники, касса, долги, выплата ЗП;
 *  - Директор — плюс капитал, ЗП учредителей, статистика, правка долгов;
 *  - Создатель — плюс правка/удаление операций кассы, удаление записей, аналитика расходов.
 */
export const ROLES = {
  CREATOR: 'Создатель',
  DIRECTOR: 'Директор',
  MANAGER: 'Менеджер',
  EMPLOYEE: 'Сотрудник',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_LEVEL: Record<string, number> = {
  [ROLES.CREATOR]: 1,
  [ROLES.DIRECTOR]: 2,
  [ROLES.MANAGER]: 3,
  [ROLES.EMPLOYEE]: 4,
};

// Без роли — как самый младший уровень (а не наоборот: раньше «нет пользователя» давало полный доступ)
const NO_ROLE_LEVEL = 99;

export function roleLevel(role?: string | null): number {
  if (!role) return NO_ROLE_LEVEL;
  return ROLE_LEVEL[role] ?? NO_ROLE_LEVEL;
}

export function userLevel(user?: Pick<AuthPayload, 'isMaster' | 'role'> | null): number {
  if (!user) return NO_ROLE_LEVEL;
  if (user.isMaster) return 0;
  return roleLevel(user.role);
}

/** Есть ли у пользователя права роли minRole (или выше) */
export function hasRole(user: Pick<AuthPayload, 'isMaster' | 'role'> | null | undefined, minRole: Role): boolean {
  return userLevel(user) <= ROLE_LEVEL[minRole];
}
