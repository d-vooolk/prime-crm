import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { isTokenRevoked } from '../utils/sessionRevocation';
import { hasRole, ROLES } from '../utils/roles';
import { signCameraToken, verifyCameraToken } from '../utils/cameraToken';
import { logger } from '../utils/logger';

/**
 * Камера офиса. Компьютер в офисе шлёт видео в MediaMTX (docker-compose, .deploy/mediamtx.yml),
 * MediaMTX нарезает его в HLS, а сервер отдаёт HLS браузеру, проверив токен просмотра.
 * Наружу MediaMTX отдаёт только приём SRT — смотреть видео в обход CRM нельзя.
 */
const PATH = 'office';
const UPSTREAM_TIMEOUT_MS = 10_000;
// Плейлист браузер перечитывает каждую секунду — проверку зрителя в базе кешируем ненадолго
const VIEWER_CACHE_MS = 30_000;

const viewerCache = new Map<string, number>();

export async function canWatch(token: string): Promise<boolean> {
  const cachedUntil = viewerCache.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  const claims = verifyCameraToken(token, env.jwtSecret);
  if (!claims) return false;
  if (await isTokenRevoked(claims.iat)) return false;
  if (!claims.isMaster) {
    // Роль и увольнение — из базы, как в authMiddleware: понизили или уволили — видео сразу пропадает
    const serviceman = await prisma.serviceman.findUnique({ where: { id: claims.sub } });
    if (!serviceman || serviceman.isDismissed) return false;
    if (!hasRole({ isMaster: false, role: serviceman.role ?? undefined }, ROLES.MANAGER)) return false;
  }

  if (viewerCache.size > 1000) viewerCache.clear();
  viewerCache.set(token, Date.now() + VIEWER_CACHE_MS);
  return true;
}

export const cameraService = {
  /** Идёт ли сейчас видео из офиса. MediaMTX недоступен — считаем, что камера выключена */
  async isOnline(): Promise<boolean> {
    try {
      const res = await fetch(`${env.cameraApiUrl}/v3/paths/get/${PATH}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const data = await res.json() as { ready?: boolean };
      return data.ready === true;
    } catch {
      return false;
    }
  },

  /** Состояние и токен просмотра для раздела «Камера» (права проверены на маршруте) */
  async session(user: { id: string; isMaster: boolean }) {
    return {
      online: await this.isOnline(),
      token: signCameraToken(user, env.jwtSecret),
    };
  },

  /** Файл HLS из MediaMTX. Имя файла проверено маршрутом */
  async fetchHls(token: string, file: string, search: string) {
    if (!(await canWatch(token))) throw new AppError('Доступ к камере закрыт', 401);

    let upstream: Response;
    try {
      upstream = await fetch(`${env.cameraHlsUrl}/${PATH}/${file}${search}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (e) {
      logger.warn('Камера: MediaMTX не отвечает', { err: e });
      throw new AppError('Камера выключена', 404);
    }
    if (!upstream.ok || !upstream.body) {
      throw new AppError('Камера выключена', upstream.status === 404 ? 404 : 502);
    }
    return {
      contentType: upstream.headers.get('content-type') || 'application/octet-stream',
      body: Readable.fromWeb(upstream.body as unknown as WebReadableStream),
    };
  },
};
