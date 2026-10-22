import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { mailApi, MailListParams } from '@/api/mail.api';

export const mailKeys = {
  all: ['mail'] as const,
  list: (params: MailListParams) => ['mail', 'list', params] as const,
  message: (id: string) => ['mail', 'message', id] as const,
  unreadCount: ['mail', 'unreadCount'] as const,
  status: ['mail', 'status'] as const,
};

/** enabled: false — пока не известны ящики (иначе сначала загрузятся письма всех ящиков) */
export const useMailList = (params: MailListParams, enabled = true) => useQuery({
  queryKey: mailKeys.list(params),
  queryFn: ({ signal }) => mailApi.getList(params, signal),
  enabled,
  placeholderData: keepPreviousData,
  // Новые письма приходят сами — список на открытой странице обновляется
  refetchInterval: 60 * 1000,
  meta: { errorTitle: 'Не удалось загрузить письма' },
});

export const useMailMessage = (id: string | null) => useQuery({
  queryKey: mailKeys.message(id ?? ''),
  queryFn: () => mailApi.getMessage(id!),
  enabled: !!id,
  meta: { errorTitle: 'Не удалось открыть письмо' },
});

/** Непрочитанные — для бейджей в меню. enabled: false — роль без почты */
export const useMailUnreadCount = (enabled = true) => useQuery({
  queryKey: mailKeys.unreadCount,
  queryFn: mailApi.getUnreadCount,
  enabled,
  staleTime: 30 * 1000,
  refetchInterval: 2 * 60 * 1000,
  meta: { silent: true },
});

/** Ящики и их непрочитанные — обновляются вместе со списком писем */
export const useMailStatus = () => useQuery({
  queryKey: mailKeys.status,
  queryFn: mailApi.getStatus,
  refetchInterval: 60 * 1000,
  meta: { silent: true },
});

/** Перечитать всё о почте (список, письмо, счётчик) */
export function useInvalidateMail() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: mailKeys.all }), [qc]);
}
