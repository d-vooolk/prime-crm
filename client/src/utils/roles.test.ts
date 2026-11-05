import { describe, expect, it } from 'vitest';
import {
  ROLES, canDeleteRecord, canEditNote, canEditServicemanRole, canEditTransactions, canSeeCapital,
  canSeeCashflow, canSeeDebts, canSeeIncomeRs, canSeeOpportunities, canSeePath, canSeeSalary, getAssignableRoles,
  getRoleLevel, getUserLevel, hasStaffAndCash, isEmployee, isWikiReviewer,
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
    expect(canSeePath(u(ROLES.EMPLOYEE), '/dashboard')).toBe(true);
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

describe('почта', () => {
  it('раздел «Почта» — только создатель и мастер', () => {
    expect(canSeePath(u(ROLES.CREATOR), '/mail')).toBe(true);
    expect(canSeePath(u(undefined, true), '/mail')).toBe(true);
    expect(canSeePath(u(ROLES.DIRECTOR), '/mail')).toBe(false);
    expect(canSeePath(u(ROLES.MANAGER), '/mail')).toBe(false);
    expect(canSeePath(u(ROLES.EMPLOYEE), '/mail')).toBe(false);
  });
});

describe('облегчённый режим (после тревожной кнопки)', () => {
  const lite = (role?: string, isMaster = false) => ({ role, isMaster, lite: true });

  it('из бухгалтерии остаются только приход и долги', () => {
    for (const user of [lite(ROLES.CREATOR), lite(undefined, true)]) {
      expect(canSeeCashflow(user)).toBe(false);
      expect(canSeeCapital(user)).toBe(false);
      expect(canSeeSalary(user)).toBe(false);
      expect(canSeeIncomeRs(user)).toBe(true);
      expect(canSeeDebts(user)).toBe(true);
    }
  });

  it('дашборда и вики нет, остальные разделы на месте', () => {
    const user = lite(ROLES.DIRECTOR);
    expect(canSeePath(user, '/dashboard')).toBe(false);
    expect(canSeePath(user, '/wiki')).toBe(false);
    expect(canSeePath(user, '/schedule')).toBe(true);
    expect(canSeePath(user, '/accounting')).toBe(true);
    expect(canSeePath(user, '/leads')).toBe(true);
    expect(canSeePath(lite(ROLES.CREATOR), '/mail')).toBe(true);
    expect(isWikiReviewer(user)).toBe(false);
  });

  it('нет сотрудников, источников, наличных и открытых возможностей', () => {
    expect(hasStaffAndCash(lite(ROLES.MANAGER))).toBe(false);
    expect(hasStaffAndCash(u(ROLES.MANAGER))).toBe(true);
    expect(canSeeOpportunities(lite(ROLES.MANAGER))).toBe(false);
    expect(canSeeOpportunities(u(ROLES.MANAGER))).toBe(true);
  });
});
