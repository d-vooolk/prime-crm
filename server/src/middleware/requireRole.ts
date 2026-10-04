import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { hasRole, Role } from '../utils/roles';

/** Пускает дальше только пользователей с ролью minRole или выше. Ставится после authMiddleware. */
export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasRole(req.user, minRole)) {
      next(new AppError('Недостаточно прав', 403));
      return;
    }
    next();
  };
}
