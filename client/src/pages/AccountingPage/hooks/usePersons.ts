import { useMemo } from 'react';
import { useServicemen } from '@/hooks/useReferenceData';
import { isDirectorRole, isManagerRole, ROLES } from '@/utils/roles';

/** Кого предлагать в полях «Изыматель», «Дебетор» и т.п. — из активных сотрудников */
export function usePersons() {
  const { data: servicemen = [] } = useServicemen();

  return useMemo(() => {
    const active = servicemen.filter(s => !s.isDismissed);
    return {
      servicemen,
      defaultPerson: servicemen.find(s => s.isDefault)?.name || '',
      managerServicemen: active.filter(s => isManagerRole(s.role)),
      directorServicemen: active.filter(s => isDirectorRole(s.role)),
      directorUser: active.find(s => s.role === ROLES.DIRECTOR),
      creatorUser: active.find(s => s.role === ROLES.CREATOR),
    };
  }, [servicemen]);
}

/** Опции Select из списка сотрудников */
export const personOptions = (list: { name: string }[]) => list.map(s => ({ value: s.name, label: s.name }));
