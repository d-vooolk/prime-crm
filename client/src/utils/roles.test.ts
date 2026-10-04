import { describe, expect, it } from 'vitest';
import {
  ROLES, canDeleteRecord, canEditNote, canEditServicemanRole, canEditTransactions, canSeeCapital,
  canSeeCashflow, canSeePath, getAssignableRoles, getRoleLevel, getUserLevel, isEmployee, isWikiReviewer,
} from './roles';

const u = (role?: string, isMaster = false) => ({ role, isMaster });

describe('доступ к бухгалтерии', () => {
  it('касса — руководители и мастер', () => {
    expect(canSeeCashflow(u(ROLES.MANAGER))).toBe(true);
    expect(canSeeCashflow(u(ROLES.EMPLOYEE))).toBe(false);
    expect(canSeeCashflow(u(undefined, true))).toBe(true);
    expect(canSeeCashflow(null)).toBe(false);
  });

  it('капитал — Создатель и Директор', () => {
    expect(canSeeCapital(u(ROLES.DIRECTOR))).toBe(true);
    expect(canSeeCapital(u(ROLES.MANAGER))).toBe(false);
  });

  it('правка операций — только Создатель', () => {
    expect(canEditTransactions(u(ROLES.CREATOR))).toBe(true);
    expect(canEditTransactions(u(ROLES.DIRECTOR))).toBe(false);
  });
});

describe('роли и навигация', () => {
  it('isEmployee', () => {
    expect(isEmployee(u(ROLES.EMPLOYEE))).toBe(true);
    expect(isEmployee(u(ROLES.MANAGER))).toBe(false);
    expect(isEmployee(null)).toBe(false);
  });

  it('сотруднику видны только разрешённые разделы', () => {
    expect(canSeePath(u(ROLES.EMPLOYEE), '/schedule')).toBe(true);
    expect(canSeePath(u(ROLES.EMPLOYEE), '/dashboard')).toBe(false);
    expect(canSeePath(u(ROLES.MANAGER), '/dashboard')).toBe(true);
  });

  it('удалить запись — мастер или Создатель', () => {
    expect(canDeleteRecord(u(ROLES.CREATOR))).toBe(true);
    expect(canDeleteRecord(u(ROLES.DIRECTOR))).toBe(false);
    expect(canDeleteRecord(u(undefined, true))).toBe(true);
  });

  it('проверяющий вики — руководители', () => {
    expect(isWikiReviewer(u(ROLES.MANAGER))).toBe(true);
    expect(isWikiReviewer(u(ROLES.EMPLOYEE))).toBe(false);
    expect(isWikiReviewer(null)).toBe(false);
  });

  it('заметку правит автор, руководитель или Создатель', () => {
    expect(canEditNote({ id: 'me', role: ROLES.EMPLOYEE }, 'me')).toBe(true);
    expect(canEditNote({ id: 'me', role: ROLES.EMPLOYEE }, 'other')).toBe(false);
    expect(canEditNote({ id: 'me', role: ROLES.MANAGER }, 'other')).toBe(true);
    expect(canEditNote({ id: 'me', role: ROLES.EMPLOYEE }, null)).toBe(false);
  });
});

describe('уровни ролей', () => {
  it('без роли и с неизвестной ролью — ниже всех', () => {
    expect(getRoleLevel(undefined)).toBe(99);
    expect(getRoleLevel('Неизвестная')).toBe(99);
    expect(getRoleLevel(ROLES.CREATOR)).toBe(1);
  });

  it('мастер — уровень 0', () => {
    expect(getUserLevel(u(ROLES.EMPLOYEE, true))).toBe(0);
  });

  it('редактировать можно сотрудников своего уровня и ниже', () => {
    expect(canEditServicemanRole(u(ROLES.DIRECTOR), ROLES.MANAGER)).toBe(true);
    expect(canEditServicemanRole(u(ROLES.DIRECTOR), ROLES.DIRECTOR)).toBe(true);
    expect(canEditServicemanRole(u(ROLES.DIRECTOR), ROLES.CREATOR)).toBe(false);
    expect(canEditServicemanRole(u(undefined, true), ROLES.CREATOR)).toBe(true);
  });

  it('назначать можно роли своего уровня и ниже', () => {
    expect(getAssignableRoles(u(ROLES.MANAGER))).toEqual([ROLES.MANAGER, ROLES.EMPLOYEE]);
    expect(getAssignableRoles(u(undefined, true))).toHaveLength(4);
  });
});
