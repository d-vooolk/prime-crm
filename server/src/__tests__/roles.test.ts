import { describe, it, expect } from 'vitest';
import { hasRole, roleLevel, userLevel, ROLES } from '../utils/roles';

describe('roles', () => {
  it('уровни ролей по старшинству', () => {
    expect(roleLevel(ROLES.CREATOR)).toBeLessThan(roleLevel(ROLES.DIRECTOR));
    expect(roleLevel(ROLES.DIRECTOR)).toBeLessThan(roleLevel(ROLES.MANAGER));
    expect(roleLevel(ROLES.MANAGER)).toBeLessThan(roleLevel(ROLES.EMPLOYEE));
  });

  it('без пользователя или роли — минимальные права', () => {
    expect(userLevel(undefined)).toBeGreaterThan(roleLevel(ROLES.EMPLOYEE));
    expect(userLevel({ isMaster: false })).toBeGreaterThan(roleLevel(ROLES.EMPLOYEE));
    expect(hasRole(undefined, ROLES.EMPLOYEE)).toBe(false);
    expect(roleLevel('Неизвестная')).toBeGreaterThan(roleLevel(ROLES.EMPLOYEE));
  });

  it('мастер-доступ проходит любую проверку', () => {
    expect(hasRole({ isMaster: true }, ROLES.CREATOR)).toBe(true);
  });

  it('роль даёт доступ к своему уровню и ниже', () => {
    const manager = { isMaster: false, role: ROLES.MANAGER };
    expect(hasRole(manager, ROLES.EMPLOYEE)).toBe(true);
    expect(hasRole(manager, ROLES.MANAGER)).toBe(true);
    expect(hasRole(manager, ROLES.DIRECTOR)).toBe(false);
    const employee = { isMaster: false, role: ROLES.EMPLOYEE };
    expect(hasRole(employee, ROLES.MANAGER)).toBe(false);
  });
});
