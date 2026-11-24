import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AuthPayload } from '../middleware/auth.middleware';
import { ROLE_LEVEL, ROLES } from '../utils/roles';
import { pushService, pushInBackground } from './push.service';

export type TaskTab = 'mine' | 'given' | 'done';

/** Задания ставят и получают менеджеры и выше */
const ASSIGNEE_ROLES = Object.keys(ROLE_LEVEL).filter(r => ROLE_LEVEL[r] <= ROLE_LEVEL[ROLES.MANAGER]);

const include = { assignee: { select: { id: true, name: true } } } as const;

/** Задания друг другу: «Мне», «От меня» и выполненные (свои и поставленные), последние 100 */
export const tasksService = {
  async list(tab: TaskTab, user: AuthPayload) {
    if (tab === 'done') {
      return prisma.task.findMany({
        where: { isDone: true, OR: [{ assigneeId: user.id }, { authorId: user.id }] },
        orderBy: { doneAt: 'desc' },
        take: 100,
        include,
      });
    }
    return prisma.task.findMany({
      where: { isDone: false, ...(tab === 'mine' ? { assigneeId: user.id } : { authorId: user.id }) },
      orderBy: { createdAt: 'desc' },
      include,
    });
  },

  async mineCount(user: AuthPayload) {
    return prisma.task.count({ where: { assigneeId: user.id, isDone: false } });
  },

  /** Кому можно поставить задание — работающие менеджеры и выше (и сам себе) */
  async assignees() {
    return prisma.serviceman.findMany({
      where: { isDismissed: false, role: { in: ASSIGNEE_ROLES } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  },

  async create(data: { text: string; assigneeId: string }, user: AuthPayload) {
    const assignee = await prisma.serviceman.findFirst({
      where: { id: data.assigneeId, isDismissed: false, role: { in: ASSIGNEE_ROLES } },
      select: { id: true },
    });
    if (!assignee) throw new AppError('Этому сотруднику нельзя поставить задание', 400);
    const task = await prisma.task.create({
      data: { text: data.text, authorId: user.id, authorName: user.name, assigneeId: assignee.id },
      include,
    });
    if (assignee.id !== user.id) {
      pushInBackground(() => pushService.sendToUsers([assignee.id], {
        title: `Задание от ${user.name}`,
        body: data.text.slice(0, 160),
        url: '/tasks',
        tag: `task-${task.id}`,
      }));
    }
    return task;
  },

  /** Отметить выполненным (или вернуть) может исполнитель или автор */
  async setDone(id: string, done: boolean, user: AuthPayload) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError('Задание не найдено', 404);
    if (task.assigneeId !== user.id && task.authorId !== user.id) throw new AppError('Недостаточно прав', 403);
    return prisma.task.update({
      where: { id },
      data: { isDone: done, doneAt: done ? new Date() : null },
      include,
    });
  },

  /** Удалить может только автор */
  async delete(id: string, user: AuthPayload) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError('Задание не найдено', 404);
    if (task.authorId !== user.id) throw new AppError('Удалить задание может только тот, кто его поставил', 403);
    await prisma.task.delete({ where: { id } });
  },
};
