import { Request, Response, NextFunction } from 'express';
import { recordsService } from '../services/records.service';
import { smsService } from '../services/sms.service';
import { prisma } from '../prisma/client';
import { hasRole, ROLES } from '../utils/roles';
import { z } from 'zod';
import { parse, money, dateString } from '../middleware/validate';

const text = (max: number) => z.string().max(max).nullable().optional();
// null от клиента = поле не задано (иначе z.coerce превратил бы null в 0 или "null")
const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(v => (v === null ? undefined : v), schema);
const nameOrNull = z.preprocess(v => (v === '' ? null : v), z.string().trim().max(150).nullable().optional());

const splitSchema = z.array(z.object({ name: z.string().trim().min(1).max(150), amount: z.coerce.number().finite() })).max(20).nullable().optional();

const itemSchema = z.object({
  serviceId: z.string().min(1, 'Не выбрана услуга'),
  price: money('Некорректная цена услуги'),
  quantity: z.coerce.number().int('Количество — целое число').min(1, 'Количество — от 1').max(10000),
  netProfit: nullToUndefined(z.coerce.number().finite().optional()),
  servicemanName: nameOrNull,
  equipmentId: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(100).optional()),
  servicemanSplit: splitSchema,
  prepaidAmount: nullToUndefined(money('Некорректная предоплата').optional()),
  prepaidByCard: z.boolean().optional(),
  prepaidCurrency: z.enum(['USD', 'EUR']).nullable().optional(),
  prepaidCurrencyAmount: money('Некорректная сумма предоплаты в валюте').nullable().optional(),
  prepaidRate: z.coerce.number().positive().finite().nullable().optional(),
});

const carSchema = z.object({
  brand: z.string().trim().min(1, 'Не выбрана марка').max(100),
  brandId: z.coerce.string().min(1),
  model: z.string().trim().min(1, 'Не выбрана модель').max(100),
  modelId: z.coerce.string().min(1),
  generation: nullToUndefined(z.string().max(100).optional()),
  generationId: nullToUndefined(z.coerce.string().max(100).optional()),
  generationName: nullToUndefined(z.string().max(200).optional()),
  year: z.coerce.string().min(1, 'Укажите год').max(10),
  plateNumber: nullToUndefined(z.string().max(30).optional()),
  mileage: nullToUndefined(z.coerce.string().max(30).optional()),
});

const legalFields = {
  isLegalEntity: z.boolean().optional(),
  legalCompanyName: text(500), legalAddress: text(1000), legalActualAddress: text(1000), legalPostalAddress: text(1000),
  legalBankDetails: text(2000), legalBic: text(50), legalUnp: text(50), legalOkpo: text(50), legalPhone: text(100), legalEmail: text(200),
  legalRepresentativePosition: text(300), legalRepresentativePositionGenitive: text(300),
  legalRepresentative: text(300), legalRepresentativeGenitive: text(300), legalBasis: text(500), legalVin: text(50), legalEndDate: text(50),
  executorSignatoryName: text(300), executorSignatoryNameGenitive: text(300),
  executorSignatoryPosition: text(300), executorSignatoryPositionGenitive: text(300), executorSignatoryBasis: text(500),
};

const recordFields = {
  clientId: z.string().min(1, 'Не выбран клиент'),
  car: carSchema,
  scheduledAt: dateString('Некорректная дата записи'),
  serviceman: nameOrNull,
  receptionist: nameOrNull,
  notes: z.string().max(5000).nullable().optional(),
  clientSourceId: z.preprocess(v => (v === '' ? null : v), z.string().max(100).nullable().optional()),
  items: z.array(itemSchema).max(200),
  ...legalFields,
};

const createSchema = z.object(recordFields);
const updateSchema = z.object(recordFields).omit({ clientId: true }).partial();

const closeSchema = z.object({
  finalPrice: money('Некорректная итоговая сумма'),
  defects: nullToUndefined(z.string().max(10000).optional()),
  recommendations: nullToUndefined(z.string().max(10000).optional()),
  warranty: nullToUndefined(z.string().max(1000).optional()),
  isPaidByBankTransfer: z.boolean().optional(),
  splitCashAmount: nullToUndefined(money().optional()),
  splitCardAmount: nullToUndefined(money().optional()),
  currencyPayments: z.array(z.object({
    currency: z.enum(['USD', 'EUR']),
    amount: z.coerce.number().positive().finite(),
    rate: z.coerce.number().positive().finite(),
  })).max(10).nullable().optional(),
});

const cancelSchema = z.object({
  retainedCashAmount: money().optional(),
  retainedCardAmount: money().optional(),
});

/**
 * Сотрудникам контакты клиента и реквизиты юрлица не показываются в интерфейсе — значит,
 * не должны уходить и в ответе API (иначе видны в инструментах разработчика).
 */
const LEGAL_KEYS = [
  'legalCompanyName', 'legalAddress', 'legalActualAddress', 'legalPostalAddress', 'legalBankDetails', 'legalBic',
  'legalUnp', 'legalOkpo', 'legalPhone', 'legalEmail', 'legalRepresentativePosition', 'legalRepresentativePositionGenitive',
  'legalRepresentative', 'legalRepresentativeGenitive', 'legalBasis',
] as const;

function forViewer<T extends { client: { id: string; name: string; phone: string; notes: string | null } }>(req: Request, record: T): T {
  if (hasRole(req.user, ROLES.MANAGER)) return record;
  const stripped: Record<string, unknown> = { ...record, client: { ...record.client, name: '', phone: '', notes: null }, smsLogs: [] };
  for (const key of LEGAL_KEYS) stripped[key] = null;
  return stripped as T;
}

const smsSchema = z.object({ type: z.enum(['CAR_READY', 'REVIEW_REQUEST'], { errorMap: () => ({ message: 'Неизвестный тип SMS' }) }) });
const defectsSchema = z.object({ defects: z.string().max(10000).nullable() });
const salaryDateSchema = z.object({ salaryDate: dateString().nullable().optional() });

export const recordsController = {
  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const records = await recordsService.findByDate(date);
      res.json({ data: records.map(r => forViewer(req, r)) });
    } catch (e) { next(e); }
  },

  async getDatesWithRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, month } = parse(z.object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
      }), req.query);
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 1);
      const records = await prisma.record.findMany({
        where: { scheduledAt: { gte: from, lt: to }, status: { not: 'CANCELLED' } },
        select: { scheduledAt: true },
      });
      const dates = [...new Set(records.map(r => {
        const d = r.scheduledAt;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }))];
      res.json({ data: dates });
    } catch (e) { next(e); }
  },

  async getIncomplete(req: Request, res: Response, next: NextFunction) {
    try {
      const clientDate = req.query.date ? String(req.query.date) : undefined;
      const records = await recordsService.findIncomplete(clientDate);
      res.json({ data: records.map(r => forViewer(req, r)) });
    } catch (e) { next(e); }
  },

  async getClosedOnDate(req: Request, res: Response, next: NextFunction) {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const records = await recordsService.findClosedOnDate(date);
      res.json({ data: records.map(r => forViewer(req, r)) });
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.findById(String(req.params.id));
      res.json({ data: forViewer(req, record) });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.create(parse(createSchema, req.body));
      res.status(201).json({ data: record });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.update(String(req.params.id), parse(updateSchema, req.body));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.close(String(req.params.id), parse(closeSchema, req.body));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.cancel(String(req.params.id), parse(cancelSchema, req.body ?? {}));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await recordsService.restore(String(req.params.id));
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await recordsService.delete(String(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async sendSms(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = parse(smsSchema, req.body);
      const result = await smsService.sendForRecord(String(req.params.id), type);
      res.json({ ok: result === 'sent', result });
    } catch (e) { next(e); }
  },

  async setDefects(req: Request, res: Response, next: NextFunction) {
    try {
      const { defects } = parse(defectsSchema, req.body);
      const record = await recordsService.setDefects(String(req.params.id), defects);
      res.json({ data: forViewer(req, record) });
    } catch (e) { next(e); }
  },

  async setSalaryDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { salaryDate } = parse(salaryDateSchema, req.body);
      const record = await recordsService.setSalaryDate(String(req.params.id), salaryDate ?? null);
      res.json({ data: record });
    } catch (e) { next(e); }
  },

  async searchCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const search = String(req.query.search || '');
      const companies = await recordsService.searchCompanies(search);
      res.json({ data: companies });
    } catch (e) { next(e); }
  },
};
