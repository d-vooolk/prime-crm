import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { parse, requiredText, money, nullableText } from '../middleware/validate';

const fields = {
  name: requiredText(200, 'Укажите название'),
  warranty: nullableText(200),
  wholesalePrice: money('Некорректная оптовая цена').nullable().optional(),
  retailPrice: money('Некорректная розничная цена').nullable().optional(),
};
const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();

/** Справочник оборудования (Bi-Led модули и т.п.). Логики почти нет — без отдельного сервиса */
export const equipmentController = {
  async getAll(_req: Request, res: Response) {
    const equipment = await prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ data: equipment });
  },

  async create(req: Request, res: Response) {
    const data = parse(createSchema, req.body);
    res.status(201).json({ data: await prisma.equipment.create({ data }) });
  },

  async update(req: Request, res: Response) {
    const data = parse(updateSchema, req.body);
    res.json({ data: await prisma.equipment.update({ where: { id: String(req.params.id) }, data }) });
  },

  // Оборудование есть в закрытых сделках — не удаляем, а скрываем
  async delete(req: Request, res: Response) {
    await prisma.equipment.update({ where: { id: String(req.params.id) }, data: { isActive: false } });
    res.json({ success: true });
  },
};
