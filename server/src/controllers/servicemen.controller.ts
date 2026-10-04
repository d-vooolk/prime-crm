import { Request, Response } from 'express';
import { z } from 'zod';
import { servicemenService } from '../services/servicemen.service';
import { parse, nullableText, money, percent, dateString } from '../middleware/validate';
import { ROLES, userLevel } from '../utils/roles';

const roleSchema = z.preprocess(
  v => (v === '' ? null : v),
  z.enum([ROLES.CREATOR, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.EMPLOYEE]).nullable().optional(),
);

const fields = {
  name: z.string().trim().min(1, 'Укажите ФИО сотрудника').max(150),
  position: nullableText(100),
  role: roleSchema,
  // Логин сотрудника — не обязательно настоящий email, поэтому формат не проверяем
  email: z.preprocess(v => (v === '' ? null : v), z.string().trim().max(200).nullable().optional()),
  // Пустой пароль при редактировании — «не менять»
  password: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(200).optional()),
  photoUrl: nullableText(500),
  isReceptionist: z.boolean().optional(),
  isPerformer: z.boolean().optional(),
  birthday: z.preprocess(v => (v === '' ? null : v), dateString('Некорректная дата рождения').nullable().optional()),
  profitPercent: percent.optional(),
  baseSalary: z.preprocess(v => (v === '' || v === null ? undefined : v), money('Некорректный оклад').optional()),
};

const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();

export const servicemenController = {
  async getAll(_req: Request, res: Response) {
    res.json({ data: await servicemenService.list(false) });
  },

  async getAllIncludingDismissed(_req: Request, res: Response) {
    res.json({ data: await servicemenService.list(true) });
  },

  async create(req: Request, res: Response) {
    const data = parse(createSchema, req.body);
    res.status(201).json({ data: await servicemenService.create(data, userLevel(req.user)) });
  },

  async update(req: Request, res: Response) {
    const data = parse(updateSchema, req.body);
    res.json({ data: await servicemenService.update(String(req.params.id), data, userLevel(req.user)) });
  },

  async dismiss(req: Request, res: Response) {
    res.json({ data: await servicemenService.dismiss(String(req.params.id), userLevel(req.user)) });
  },

  async restore(req: Request, res: Response) {
    res.json({ data: await servicemenService.restore(String(req.params.id), userLevel(req.user)) });
  },

  async setDefault(req: Request, res: Response) {
    res.json({ data: await servicemenService.setDefaultReceptionist(String(req.params.id)) });
  },

  async delete(req: Request, res: Response) {
    await servicemenService.delete(String(req.params.id), userLevel(req.user));
    res.json({ success: true });
  },

  async getTodayBirthdays(_req: Request, res: Response) {
    res.json({ data: await servicemenService.todayBirthdays() });
  },
};
