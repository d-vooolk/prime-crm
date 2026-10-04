import { useMemo } from 'react';
import { useServicemen } from '@/hooks/useReferenceData';
import { useAuthStore } from '@/store/authStore';
import { isDirectorRole, isManagerRole, ROLES } from '@/utils/roles';
import { pickDefaultPerson } from '../utils';

/** Кого предлагать в полях «Изыматель», «Дебетор» и т.п. — из активных сотрудников */
export function usePersons() {
  const { data: servicemen = [] } = useServicemen();
  const userName = useAuthStore(s => s.user?.name);

  return useMemo(() => {
    const active = servicemen.filter(s => !s.isDismissed);
    const managerServicemen = active.filter(s => isManagerRole(s.role));
    const directorServicemen = active.filter(s => isDirectorRole(s.role));
    const fallback = servicemen.find(s => s.isDefault)?.name || '';
    return {
      servicemen,
      // По умолчанию — тот, кто вошёл (среди менеджеров и выше), иначе сотрудник по умолчанию
      defaultPerson: pickDefaultPerson(userName, managerServicemen, fallback),
      // Для полей, где выбор только из директоров (изъятие из капитала)
      defaultDirectorPerson: pickDefaultPerson(userName, directorServicemen, fallback),
      managerServicemen,
      directorServicemen,
      directorUser: active.find(s => s.role === ROLES.DIRECTOR),
      creatorUser: active.find(s => s.role === ROLES.CREATOR),
    };
  }, [servicemen, userName]);
}

/** Опции Select из списка сотрудников */
export const personOptions = (list: { name: string }[]) => list.map(s => ({ value: s.name, label: s.name }));
