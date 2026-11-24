import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/api/contacts.api';

const contactKeys = { all: ['contacts'] as const };

export const useContacts = () => useQuery({
  queryKey: contactKeys.all,
  queryFn: contactsApi.list,
  meta: { errorTitle: 'Не удалось загрузить контакты' },
});

export function useInvalidateContacts() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: contactKeys.all }), [qc]);
}
