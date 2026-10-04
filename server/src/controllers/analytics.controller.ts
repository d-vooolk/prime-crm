import { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service';
import { parse, dateString } from '../middleware/validate';
import { hasRole, ROLES } from '../utils/roles';

const periodSchema = z.enum(['day', 'week', 'month', 'quarter', 'year']).catch('month');

const rangeSchema = z.object({
  from: dateString('Некорректная дата начала'),
  to: dateString('Некорректная дата конца'),
});

export const analyticsController = {
  async getSummary(req: Request, res: Response) {
    res.json({ data: await analyticsService.getSummary(periodSchema.parse(req.query.period)) });
  },

  async getRevenue(req: Request, res: Response) {
    const from = String(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const to = String(req.query.to || new Date().toISOString());
    const range = parse(rangeSchema, { from, to });
    res.json({ data: await analyticsService.getRevenueChart(range.from, range.to) });
  },

  async getTopServices(req: Request, res: Response) {
    res.json({ data: await analyticsService.getTopServices(periodSchema.parse(req.query.period)) });
  },

  /** Каналы привлечения клиентов за период [from; to] (YYYY-MM-DD, включительно) */
  async getSources(req: Request, res: Response) {
    const range = parse(rangeSchema, req.query);
    const stats = await analyticsService.getSourceStats(range.from, range.to);
    // Выручку по каналам видят директора и выше — как и выручку на главной вкладке дашборда
    if (!hasRole(req.user, ROLES.DIRECTOR)) stats.sources = stats.sources.map(s => ({ ...s, revenue: 0 }));
    res.json({ data: stats });
  },
};
