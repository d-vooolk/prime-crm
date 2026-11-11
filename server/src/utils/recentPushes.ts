/**
 * Последние пуши каждого пользователя — в памяти сервера, на час.
 * Нужны iPhone: у установленного приложения, свёрнутого в фон, нажатие на уведомление лишь
 * разворачивает его — service worker о нажатии не узнаёт (WebKit bug 282935), а записанное им
 * в хранилище при приходе пуша приложению не видно. Поэтому приложение после возврата спрашивает
 * сервер, что ему пришло, пока оно было свёрнуто (GET /api/push/recent). Перезапуск сервера
 * список теряет — это не страшно.
 */
export interface RecentPush {
  id: string;
  url: string;
  title: string;
  body: string;
  at: number;
}

export const RECENT_PUSH_TTL_MS = 60 * 60 * 1000;
const RECENT_PUSH_MAX = 10;

export function createRecentPushes() {
  const byUser = new Map<string, RecentPush[]>();

  const fresh = (list: RecentPush[], now: number) => list.filter(p => now - p.at <= RECENT_PUSH_TTL_MS);

  return {
    remember(userIds: string[], push: RecentPush) {
      for (const userId of new Set(userIds)) {
        const list = fresh(byUser.get(userId) ?? [], push.at);
        byUser.set(userId, [...list, push].slice(-RECENT_PUSH_MAX));
      }
      // Чтобы карта не росла от пользователей, которым давно ничего не приходило
      for (const [userId, list] of byUser) {
        if (!fresh(list, push.at).length) byUser.delete(userId);
      }
    },

    /** Последний пуш пользователю не раньше since */
    latestSince(userId: string, since: number, now: number): RecentPush | null {
      const list = fresh(byUser.get(userId) ?? [], now).filter(p => p.at >= since);
      return list.length ? list[list.length - 1] : null;
    },
  };
}

export const recentPushes = createRecentPushes();
