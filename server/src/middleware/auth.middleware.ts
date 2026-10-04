import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { currentContext } from '../utils/requestContext';

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  role?: string;
  isMaster: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Проверка токена. Роль и имя берутся из базы, а не из токена: смена роли или увольнение
 * действуют сразу, без повторного входа. Уволенный получает 401 — клиент разлогинивает его.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }
  let payload: AuthPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthPayload;
  } catch {
    res.status(401).json({ message: 'Сессия недействительна, войдите заново' });
    return;
  }
  try {
    if (payload.isMaster) {
      req.user = payload;
    } else {
      const serviceman = await prisma.serviceman.findUnique({ where: { id: payload.id } });
      if (!serviceman || serviceman.isDismissed) {
        res.status(401).json({ message: 'Доступ закрыт' });
        return;
      }
      req.user = {
        id: serviceman.id,
        email: serviceman.email ?? payload.email,
        name: serviceman.name,
        role: serviceman.role ?? undefined,
        isMaster: false,
      };
    }
    // Журнал изменений и логи узнают, кто выполняет запрос
    const ctx = currentContext();
    if (ctx) {
      ctx.userId = req.user.id;
      ctx.userName = req.user.name;
    }
    next();
  } catch (e) {
    next(e);
  }
};
