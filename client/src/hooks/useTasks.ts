import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi, TaskTab } from '@/api/tasks.api';

const taskKeys = {
  all: ['tasks'] as const,
  list: (tab: TaskTab) => ['tasks', 'list', tab] as const,
  mineCount: ['tasks', 'mineCount'] as const,
  assignees: ['tasks', 'assignees'] as const,
};

export const useTasks = (tab: TaskTab) => useQuery({
  queryKey: taskKeys.list(tab),
  queryFn: () => tasksApi.list(tab),
  // Задания ставят друг другу — открытая страница обновляется
  refetchInterval: 60 * 1000,
  meta: { errorTitle: 'Не удалось загрузить задания' },
});

/** Невыполненные задания мне — для бейджа в меню. enabled: false — роль без заданий */
export const useTasksMineCount = (enabled = true) => useQuery({
  queryKey: taskKeys.mineCount,
  queryFn: tasksApi.mineCount,
  enabled,
  staleTime: 30 * 1000,
  refetchInterval: 2 * 60 * 1000,
  meta: { silent: true },
});

export const useTaskAssignees = (enabled = true) => useQuery({
  queryKey: taskKeys.assignees,
  queryFn: tasksApi.assignees,
  enabled,
  staleTime: 5 * 60 * 1000,
  meta: { errorTitle: 'Не удалось загрузить сотрудников' },
});

export function useInvalidateTasks() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: taskKeys.all }), [qc]);
}
