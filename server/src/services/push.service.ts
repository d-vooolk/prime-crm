import webpush from 'web-push';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';
import { ROLE_LEVEL, ROLES } from '../utils/roles';

/**
 * Пуш-уведомления на телефоны и компьютеры сотрудников (PWA).
 * Ключи VAPID — в .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT). Без них пуши
 * просто выключены: всё остальное работает, а настройка в интерфейсе скажет, что они недоступны.
 */
export interface PushPayload {
  title: string;
  body: string;
  /** Куда перейти по нажатию на уведомление */
  url?: string;
  /** Уведомления с одинаковым tag заменяют друг друга, а не копятся */
  tag?: string;
}

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (configured) {
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@prime-auto.by', VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  } else {
    logger.warn('Пуш-уведомления выключены: не заданы VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
  }
  return configured;
}

export const pushService = {
  publicKey(): string | null {
    return ensureConfigured() ? process.env.VAPID_PUBLIC_KEY! : null;
  },

  async subscribe(user: { id: string; name: string }, sub: { endpoint: string; p256dh: string; auth: string }, userAgent?: string) {
    // Одно устройство — одна подписка: при входе другим пользователем подписка переходит к нему
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { p256dh: sub.p256dh, auth: sub.auth, userId: user.id, userName: user.name, userAgent: userAgent ?? null },
      create: { ...sub, userId: user.id, userName: user.name, userAgent: userAgent ?? null },
    });
  },

  async unsubscribe(endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },

  /** Отправка на все устройства пользователей. Ошибки не пробрасываются — пуш не должен ломать основное действие */
  async sendToUsers(userIds: string[], payload: PushPayload) {
    if (!userIds.length || !ensureConfigured()) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Подписка больше не существует (удалили приложение, отозвали разрешение)
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          logger.warn('Не удалось отправить пуш', { status, user: s.userName });
        }
      }
    }));
  },

  /** id пользователей с ролью minRole и выше (уволенные — нет) плюс мастер-доступ */
  async roleUserIds(minRole: typeof ROLES[keyof typeof ROLES]): Promise<string[]> {
    const roles = Object.entries(ROLE_LEVEL).filter(([, lvl]) => lvl <= ROLE_LEVEL[minRole]).map(([r]) => r);
    const users = await prisma.serviceman.findMany({ where: { isDismissed: false, role: { in: roles } }, select: { id: true } });
    return [...users.map(u => u.id), 'master'];
  },

  /** Всем пользователям с ролью minRole и выше (и мастер-доступу) */
  async sendToRole(minRole: typeof ROLES[keyof typeof ROLES], payload: PushPayload) {
    if (!ensureConfigured()) return;
    await pushService.sendToUsers(await pushService.roleUserIds(minRole), payload);
  },

  /**
   * Новая запись: менеджерам, директорам и создателю — всегда, а мастеру записи — даже если он
   * сотрудник. Каждому по одному уведомлению (sendToUsers убирает повторы).
   */
  async sendNewRecord(servicemanName: string | null | undefined, payload: PushPayload) {
    if (!ensureConfigured()) return;
    const ids = await pushService.roleUserIds(ROLES.MANAGER);
    if (servicemanName) {
      const s = await prisma.serviceman.findUnique({ where: { name: servicemanName }, select: { id: true, isDismissed: true } });
      if (s && !s.isDismissed) ids.push(s.id);
    }
    await pushService.sendToUsers(ids, payload);
  },
};

/** Пуш в фоне: вызывающий код не ждёт и не падает */
export function pushInBackground(task: () => Promise<unknown>) {
  task().catch(err => logger.error('Ошибка отправки пуша', { err }));
}
