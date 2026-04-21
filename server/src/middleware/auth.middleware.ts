import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';

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

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'prime-crm-secret') as AuthPayload;
    if (!payload.isMaster && payload.id) {
      const serviceman = await prisma.serviceman.findUnique({ where: { id: payload.id } });
      if (!serviceman || serviceman.isDismissed) {
        res.status(401).json({ message: 'Доступ запрещён' });
        return;
      }
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Токен недействителен или истёк' });
  }
};
