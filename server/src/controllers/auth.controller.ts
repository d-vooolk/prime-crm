import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import type { AuthPayload } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'prime-crm-secret';
const MASTER_EMAIL = process.env.MASTER_EMAIL || 'admin@prime.local';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123';

const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, JWT_SECRET);

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as { email: string; password: string };

      if (!email || !password) {
        res.status(400).json({ message: 'Введите email и пароль' });
        return;
      }

      // Master account — always works, credentials from env
      if (email === MASTER_EMAIL) {
        if (password !== MASTER_PASSWORD) {
          res.status(401).json({ message: 'Неверный пароль' });
          return;
        }
        const token = signToken({ id: 'master', email: MASTER_EMAIL, name: 'Администратор', isMaster: true });
        res.json({ data: { token, user: { id: 'master', name: 'Администратор', email: MASTER_EMAIL, isMaster: true } } });
        return;
      }

      // Regular employee login
      const serviceman = await prisma.serviceman.findFirst({
        where: { email, isDismissed: false },
      });

      if (!serviceman || !serviceman.password) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
      }

      let passwordMatch = false;

      // Try bcrypt first (for hashed passwords)
      if (serviceman.password.startsWith('$2')) {
        passwordMatch = await bcrypt.compare(password, serviceman.password);
      } else {
        // Plain text fallback for legacy passwords — rehash on success
        passwordMatch = serviceman.password === password;
        if (passwordMatch) {
          const hashed = await bcrypt.hash(password, 10);
          await prisma.serviceman.update({ where: { id: serviceman.id }, data: { password: hashed } });
        }
      }

      if (!passwordMatch) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
      }

      const token = signToken({
        id: serviceman.id,
        email: serviceman.email!,
        name: serviceman.name,
        role: serviceman.role || undefined,
        isMaster: false,
      });

      res.json({
        data: {
          token,
          user: { id: serviceman.id, name: serviceman.name, email: serviceman.email, role: serviceman.role, isMaster: false },
        },
      });
    } catch (e) { next(e); }
  },

  async me(req: Request, res: Response) {
    res.json({ data: req.user });
  },
};
