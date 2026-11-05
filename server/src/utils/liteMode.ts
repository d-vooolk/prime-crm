import { Request, Response, NextFunction } from 'express';
import { prisma, DbClient } from '../prisma/client';

/**
 * Облегчённый режим — CRM после тревожной кнопки (services/panic.service.ts). Работают расписание,
 * записи, «Приход» (РС), долги, заявки, почта, заметки и справочники. Клиентской базы,
 * сотрудников, аналитики, вики, наличной кассы, капитала, ЗП и VDF нет; все приходы — по РС,
 * входят только Создатель, Директор, Менеджер и мастер-доступ.
 *
 * Флаг ставится в той же транзакции, что и очистка, уже после шифрования базы: восстановленная
 * из архива база возвращается в обычный режим сама. Кешируется в памяти, как отзыв сессий.
 */
const ID = 'singleton';
let cached: Promise<boolean> | null = null;

export function isLiteMode(): Promise<boolean> {
  cached ??= prisma.securityState.findUnique({ where: { id: ID } })
    .then(s => s?.liteMode ?? false)
    .catch((e) => { cached = null; throw e; });
  return cached;
}

/** Включается внутри транзакции очистки; кеш обновить после коммита — markLiteModeOn() */
export async function enableLiteMode(db: DbClient): Promise<void> {
  await db.securityState.upsert({
    where: { id: ID },
    create: { id: ID, liteMode: true },
    update: { liteMode: true },
  });
}

export function markLiteModeOn(): void {
  cached = Promise.resolve(true);
}

/** Маршрут, которого в облегчённом режиме нет: 404, как будто его не было никогда */
export async function hiddenInLiteMode(_req: Request, res: Response, next: NextFunction) {
  try {
    if (await isLiteMode()) {
      res.status(404).json({ message: 'Не найдено' });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
