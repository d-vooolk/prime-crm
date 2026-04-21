import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { AuthPayload } from '../middleware/auth.middleware';

const ROLE_LEVEL: Record<string, number> = {
  'Создатель': 1, 'Директор': 2, 'Менеджер': 3, 'Сотрудник': 4,
};
function getLevel(role?: string | null): number {
  if (!role) return 99;
  return ROLE_LEVEL[role] ?? 99;
}
function requesterLevel(req: Request): number {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user) return 0;
  if (user.isMaster) return 0;
  return getLevel(user.role);
}

export const servicesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        include: { services: { where: { isActive: true }, orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      });
      res.json({ data: categories });
    } catch (e) { next(e); }
  },

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await prisma.category.create({ data: { name: req.body.name } });
      res.status(201).json({ data: category });
    } catch (e) { next(e); }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await prisma.category.update({
        where: { id: String(req.params.id) },
        data: { name: req.body.name },
      });
      res.json({ data: category });
    } catch (e) { next(e); }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.category.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true });
    } catch (e) { next(e); }
  },

  async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await prisma.service.create({
        data: req.body,
        include: { category: true },
      });
      res.status(201).json({ data: service });
    } catch (e) { next(e); }
  },

  async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await prisma.service.update({
        where: { id: String(req.params.id) },
        data: req.body,
        include: { category: true },
      });
      res.json({ data: service });
    } catch (e) { next(e); }
  },

  async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.service.update({
        where: { id: String(req.params.id) },
        data: { isActive: false },
      });
      res.json({ success: true });
    } catch (e) { next(e); }
  },
};

export const equipmentController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await prisma.equipment.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      res.json({ data: equipment });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, warranty, wholesalePrice, retailPrice } = req.body;
      const equipment = await prisma.equipment.create({
        data: { name, warranty, wholesalePrice, retailPrice },
      });
      res.status(201).json({ data: equipment });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, warranty, wholesalePrice, retailPrice } = req.body;
      const equipment = await prisma.equipment.update({
        where: { id: String(req.params.id) },
        data: {
          ...(name !== undefined && { name }),
          ...(warranty !== undefined && { warranty }),
          ...(wholesalePrice !== undefined && { wholesalePrice }),
          ...(retailPrice !== undefined && { retailPrice }),
        },
      });
      res.json({ data: equipment });
    } catch (e) { next(e); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.equipment.update({
        where: { id: String(req.params.id) },
        data: { isActive: false },
      });
      res.json({ success: true });
    } catch (e) { next(e); }
  },
};

export const servicemanController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const servicemen = await prisma.serviceman.findMany({
        where: { isDismissed: false },
        orderBy: { name: 'asc' },
      });
      res.json({ data: servicemen });
    } catch (e) { next(e); }
  },

  async getAllIncludingDismissed(_req: Request, res: Response, next: NextFunction) {
    try {
      const servicemen = await prisma.serviceman.findMany({ orderBy: { name: 'asc' } });
      res.json({ data: servicemen });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, position, role, email, password, photoUrl, isReceptionist } = req.body;
      const myLevel = requesterLevel(req);
      if (myLevel !== 0 && getLevel(role) < myLevel) {
        res.status(403).json({ message: 'Нельзя назначить роль выше вашего уровня' });
        return;
      }
      const hashed = password ? await bcrypt.hash(password, 10) : undefined;
      const s = await prisma.serviceman.create({
        data: { name, position, role, email, password: hashed, photoUrl, isReceptionist: !!isReceptionist },
      });
      res.status(201).json({ data: s });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, position, role, email, password, photoUrl, isReceptionist } = req.body;
      const myLevel = requesterLevel(req);
      const existing = await prisma.serviceman.findUnique({ where: { id: String(req.params.id) } });
      if (!existing) { res.status(404).json({ message: 'Сотрудник не найден' }); return; }
      if (myLevel !== 0 && getLevel(existing.role) < myLevel) {
        res.status(403).json({ message: 'Недостаточно прав для редактирования этого сотрудника' });
        return;
      }
      if (myLevel !== 0 && getLevel(role) < myLevel) {
        res.status(403).json({ message: 'Нельзя назначить роль выше вашего уровня' });
        return;
      }
      const hashed = password ? await bcrypt.hash(password, 10) : undefined;
      const s = await prisma.serviceman.update({
        where: { id: String(req.params.id) },
        data: { name, position, role, email, ...(hashed !== undefined && { password: hashed }), photoUrl, isReceptionist },
      });
      res.json({ data: s });
    } catch (e) { next(e); }
  },

  async dismiss(req: Request, res: Response, next: NextFunction) {
    try {
      const myLevel = requesterLevel(req);
      const existing = await prisma.serviceman.findUnique({ where: { id: String(req.params.id) } });
      if (!existing) { res.status(404).json({ message: 'Сотрудник не найден' }); return; }
      if (myLevel !== 0 && getLevel(existing.role) < myLevel) {
        res.status(403).json({ message: 'Недостаточно прав для увольнения этого сотрудника' });
        return;
      }
      const s = await prisma.serviceman.update({
        where: { id: String(req.params.id) },
        data: { isDismissed: true, isDefault: false },
      });
      res.json({ data: s });
    } catch (e) { next(e); }
  },

  async setDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await prisma.serviceman.updateMany({
        where: { isReceptionist: true },
        data: { isDefault: false },
      });
      const s = await prisma.serviceman.update({
        where: { id },
        data: { isDefault: true },
      });
      res.json({ data: s });
    } catch (e) { next(e); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.serviceman.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true });
    } catch (e) { next(e); }
  },
};

export const settingsController = {
  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.companySettings.findFirst();
      res.json({ data: settings });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.companySettings.findFirst();
      let settings;
      if (existing) {
        settings = await prisma.companySettings.update({
          where: { id: existing.id },
          data: req.body,
        });
      } else {
        settings = await prisma.companySettings.create({ data: req.body });
      }
      res.json({ data: settings });
    } catch (e) { next(e); }
  },
};

export const smsSettingsController = {
  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.smsSettings.findFirst();
      res.json({ data: settings });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.smsSettings.findFirst();
      const { enabled, username, password, onCreateTemplate, reminderTemplate, carReadyTemplate, reviewRequestTemplate } = req.body;
      const data = { enabled, username, password, onCreateTemplate, reminderTemplate, carReadyTemplate, reviewRequestTemplate };
      const settings = existing
        ? await prisma.smsSettings.update({ where: { id: existing.id }, data })
        : await prisma.smsSettings.create({ data });
      res.json({ data: settings });
    } catch (e) { next(e); }
  },
};

export const documentTemplateController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await prisma.documentTemplate.findMany({
        include: { category: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      res.json({ data: templates });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, content, isDefault, categoryId } = req.body;
      if (isDefault) {
        await prisma.documentTemplate.updateMany({ where: { type, isDefault: true }, data: { isDefault: false } });
      }
      const template = await prisma.documentTemplate.create({
        data: { name, type: type || 'work_order', content, isDefault: !!isDefault, categoryId: categoryId || null },
        include: { category: true },
      });
      res.status(201).json({ data: template });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, content, isDefault, categoryId } = req.body;
      const existing = await prisma.documentTemplate.findUnique({ where: { id: String(req.params.id) } });
      if (!existing) { res.status(404).json({ error: 'Не найден' }); return; }
      if (isDefault) {
        await prisma.documentTemplate.updateMany({
          where: { type: existing.type, isDefault: true, id: { not: existing.id } },
          data: { isDefault: false },
        });
      }
      const template = await prisma.documentTemplate.update({
        where: { id: String(req.params.id) },
        data: { name, content, isDefault: isDefault !== undefined ? !!isDefault : existing.isDefault, categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId },
        include: { category: true },
      });
      res.json({ data: template });
    } catch (e) { next(e); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.documentTemplate.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true });
    } catch (e) { next(e); }
  },
};

export const analyticsController = {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { analyticsService } = await import('../services/analytics.service');
      const period = (req.query.period as 'day' | 'week' | 'month' | 'quarter' | 'year') || 'month';
      const data = await analyticsService.getSummary(period);
      res.json({ data });
    } catch (e) { next(e); }
  },

  async getRevenue(req: Request, res: Response, next: NextFunction) {
    try {
      const { analyticsService } = await import('../services/analytics.service');
      const from = String(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const to = String(req.query.to || new Date().toISOString());
      const data = await analyticsService.getRevenueChart(from, to);
      res.json({ data });
    } catch (e) { next(e); }
  },

  async getTopServices(req: Request, res: Response, next: NextFunction) {
    try {
      const { analyticsService } = await import('../services/analytics.service');
      const period = (req.query.period as 'day' | 'week' | 'month' | 'quarter' | 'year') || 'month';
      const data = await analyticsService.getTopServices(period);
      res.json({ data });
    } catch (e) { next(e); }
  },
};
