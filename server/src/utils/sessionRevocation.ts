import { prisma } from '../prisma/client';

/**
 * Отзыв всех сессий разом. Токены без срока действия, поэтому «выйти везде» — это момент
 * в базе: токен, выданный раньше него (iat), недействителен. Момент кешируется в памяти,
 * чтобы не читать базу на каждый запрос.
 */
const ID = 'singleton';
let cached: Promise<number | null> | null = null;

function load(): Promise<number | null> {
  cached ??= prisma.securityState.findUnique({ where: { id: ID } })
    .then(s => s?.sessionsRevokedAt?.getTime() ?? null)
    .catch((e) => { cached = null; throw e; });
  return cached;
}

/** Токен выдан до отзыва? iat — секунды (как в JWT) */
export async function isTokenRevoked(iat: number | undefined): Promise<boolean> {
  const revokedAt = await load();
  if (revokedAt == null) return false;
  // Без iat токен не проверить — считаем отозванным
  return iat == null || iat * 1000 < revokedAt;
}

export async function revokeAllSessions(): Promise<void> {
  // iat в целых секундах. Округление вверх: токен, выданный в ту же секунду до отзыва, тоже
  // недействителен (вход в эту же секунду после отзыва придётся повторить — это не страшно)
  const now = new Date(Math.ceil(Date.now() / 1000) * 1000);
  await prisma.securityState.upsert({
    where: { id: ID },
    create: { id: ID, sessionsRevokedAt: now },
    update: { sessionsRevokedAt: now },
  });
  cached = Promise.resolve(now.getTime());
}
