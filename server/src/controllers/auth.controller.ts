import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { loginLimiter, LOCK_MINUTES } from '../utils/loginLimiter';
import { logger } from '../utils/logger';
import type { AuthPayload } from '../middleware/auth.middleware';

// Срок жизни токена не ограничен намеренно: сотрудники не должны входить заново каждый день.
// Роль и увольнение всё равно проверяются по базе на каждом запросе (auth.middleware).
const signToken = (payload: AuthPayload) => jwt.sign(payload, env.jwtSecret);

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Введите email и пароль').max(200),
  password: z.string().min(1, 'Введите email и пароль').max(200),
});

/** Сравнение строк за постоянное время — по времени ответа нельзя угадать пароль */
function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const MASTER_USER = { id: 'master', name: 'Администратор', isMaster: true } as const;

export const authController = {
  async login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Введите email и пароль', 400);
    const { email, password } = parsed.data;
    const ip = req.ip || 'unknown';

    const wait = loginLimiter.minutesLeft(email, ip);
    if (wait > 0) {
      throw new AppError(`Слишком много неудачных попыток входа. Попробуйте через ${wait} мин.`, 429);
    }

    const failed = (): never => {
      const left = loginLimiter.fail(email, ip);
      logger.warn('Неудачная попытка входа', { email, ip, attemptsLeft: left });
      throw new AppError(
        left > 0
          ? `Неверный email или пароль. Осталось попыток: ${left}`
          : `Неверный email или пароль. Вход заблокирован на ${LOCK_MINUTES} мин.`,
        401,
      );
    };

    // Мастер-доступ — учётные данные из переменных окружения
    if (email === env.masterEmail) {
      if (!safeEqual(password, env.masterPassword)) failed();
      loginLimiter.success(email);
      const user = { ...MASTER_USER, email: env.masterEmail };
      res.json({ data: { token: signToken(user), user } });
      return;
    }

    const serviceman = await prisma.serviceman.findFirst({
      where: { email, isDismissed: false },
      omit: { password: false },
    });
    const hash = serviceman?.password;
    if (!serviceman || !hash) return failed();

    let passwordMatch: boolean;
    if (hash.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, hash);
    } else {
      // Старые пароли, сохранённые без хеша, — хешируем при первом удачном входе
      passwordMatch = safeEqual(hash, password);
      if (passwordMatch) {
        await prisma.serviceman.update({ where: { id: serviceman.id }, data: { password: await bcrypt.hash(password, 10) } });
      }
    }
    if (!passwordMatch) failed();

    loginLimiter.success(email);
    const token = signToken({
      id: serviceman.id, email: serviceman.email!, name: serviceman.name, role: serviceman.role || undefined, isMaster: false,
    });
    res.json({
      data: {
        token,
        user: { id: serviceman.id, name: serviceman.name, email: serviceman.email, role: serviceman.role, isMaster: false },
      },
    });
  },

  /** Актуальные данные пользователя из базы — клиент обновляет по ним роль и имя */
  async me(req: Request, res: Response) {
    const user = req.user!;
    if (user.isMaster) {
      res.json({ data: { ...MASTER_USER, email: user.email } });
      return;
    }
    const s = await prisma.serviceman.findUnique({ where: { id: user.id } });
    if (!s) throw new AppError('Пользователь не найден', 401);
    res.json({ data: { id: s.id, name: s.name, email: s.email, role: s.role, isMaster: false } });
  },
};
