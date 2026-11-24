import http from './http';

/** «Мне», «От меня», выполненные */
export type TaskTab = 'mine' | 'given' | 'done';

export interface Task {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  assigneeId: string;
  assignee: { id: string; name: string };
  isDone: boolean;
  doneAt: string | null;
  createdAt: string;
}

export interface TaskAssignee {
  id: string;
  name: string;
  role: string | null;
}

export const tasksApi = {
  list: (tab: TaskTab) =>
    http.get<{ data: Task[] }>('/tasks', { params: { tab } }).then(r => r.data.data),

  mineCount: () =>
    http.get<{ data: { count: number } }>('/tasks/count').then(r => r.data.data.count),

  assignees: () =>
    http.get<{ data: TaskAssignee[] }>('/tasks/assignees').then(r => r.data.data),

  create: (data: { text: string; assigneeId: string }) =>
    http.post<{ data: Task }>('/tasks', data).then(r => r.data.data),

  setDone: (id: string, done: boolean) =>
    http.post<{ data: Task }>(`/tasks/${id}/done`, { done }).then(r => r.data.data),

  delete: (id: string) =>
    http.delete(`/tasks/${id}`),
};
