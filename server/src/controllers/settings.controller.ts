import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { smsService } from '../services/sms.service';
import { AppError } from '../middleware/errorHandler';
import { parse, nullableText, requiredText, optionalText } from '../middleware/validate';

// ─── Реквизиты компании ─────────────────────────────

const text = nullableText(2000);

const authorizedPersonSchema = z.object({
  nameNominative: z.string().max(200),
  nameGenitive: z.string().max(200),
  positionNominative: z.string().max(200),
  positionGenitive: z.string().max(200),
  basis: z.string().max(500),
});

const actMemoBlockSchema = z.object({
  id: z.string().max(100),
  title: z.string().max(300),
  text: z.string().max(20000),
  targets: z.array(z.string().max(100)).max(500),
});

const companySettingsSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название компании').max(300),
  directorName: text,
  directorNameGenitive: text,
  directorPosition: text,
  directorPositionGenitive: text,
  directorBasis: text,
  authorizedPersons: z.array(authorizedPersonSchema).max(50).nullable(),
  legalAddress: text,
  actualAddress: text,
  postalAddress: text,
  phone: text,
  email: text,
  taxId: text,
  bic: text,
  okpo: text,
  bankDetails: text,
  logoUrl: text,
  documentPrefix: z.string().trim().min(1, 'Укажите префикс документов').max(20),
  // Счётчик номеров документов: можно задать стартовый номер, но не отрицательный и не дробный
  nextDocumentNumber: z.coerce.number().int('Номер документа — целое число').min(1, 'Номер документа — от 1'),
  actMemo: z.string().max(20000).nullable(),
  actMemoBlocks: z.array(actMemoBlockSchema).max(200).nullable(),
}).partial();

const jsonOrNull = (v: unknown) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

export const settingsController = {
  async get(_req: Request, res: Response) {
    res.json({ data: await prisma.companySettings.findFirst() });
  },

  async update(req: Request, res: Response) {
    const { authorizedPersons, actMemoBlocks, ...rest } = parse(companySettingsSchema, req.body);
    const data = {
      ...rest,
      ...(authorizedPersons !== undefined && { authorizedPersons: jsonOrNull(authorizedPersons) }),
      ...(actMemoBlocks !== undefined && { actMemoBlocks: jsonOrNull(actMemoBlocks) }),
    };
    const existing = await prisma.companySettings.findFirst();
    const settings = existing
      ? await prisma.companySettings.update({ where: { id: existing.id }, data })
      : await prisma.companySettings.create({ data: { name: rest.name ?? 'Компания', ...data } });
    res.json({ data: settings });
  },
};

// ─── SMS ────────────────────────────────────────────

const smsSettingsSchema = z.object({
  enabled: z.boolean(),
  // Пустой токен — «оставить сохранённый»: токен наружу не отдаётся, форма присылает пустое поле
  token: optionalText(500),
  alphanameId: z.string().trim().max(100),
  alphaname: z.string().trim().max(100),
  onCreateTemplate: z.string().max(2000),
  reminderTemplate: z.string().max(2000),
  carReadyTemplate: z.string().max(2000),
  reviewRequestTemplate: z.string().max(2000),
}).partial();

/** Токен sms.by наружу не отдаём целиком — только последние символы, чтобы было видно, что он задан */
function maskSmsSettings<T extends { token: string }>(settings: T | null) {
  if (!settings) return null;
  const { token, ...rest } = settings;
  return { ...rest, token: '', tokenMask: token ? `••••${token.slice(-4)}` : '' };
}

export const smsSettingsController = {
  async get(_req: Request, res: Response) {
    res.json({ data: maskSmsSettings(await prisma.smsSettings.findFirst()) });
  },

  async update(req: Request, res: Response) {
    const data = parse(smsSettingsSchema, req.body);
    const existing = await prisma.smsSettings.findFirst();
    const settings = existing
      ? await prisma.smsSettings.update({ where: { id: existing.id }, data })
      : await prisma.smsSettings.create({ data });
    res.json({ data: maskSmsSettings(settings) });
  },

  /** Проверка токена: баланс и доступные альфа-имена */
  async check(req: Request, res: Response) {
    const token = typeof req.query.token === 'string' && req.query.token ? req.query.token : undefined;
    try {
      res.json({ data: await smsService.checkConnection(token) });
    } catch (e) {
      throw new AppError(e instanceof Error ? e.message : 'Ошибка подключения к sms.by', 400);
    }
  },

  /** Тестовая отправка */
  async test(req: Request, res: Response) {
    const { phone, message } = parse(z.object({
      phone: requiredText(40, 'Не указан номер телефона'),
      message: optionalText(1000),
    }), req.body);
    try {
      res.json({ data: await smsService.sendTest(phone, message || 'Тестовое сообщение от Prime CRM') });
    } catch (e) {
      throw new AppError(e instanceof Error ? e.message : 'Ошибка отправки', 400);
    }
  },
};

// ─── Шаблоны документов ─────────────────────────────

const templateSchema = z.object({
  name: requiredText(200, 'Укажите название шаблона'),
  type: z.enum(['work_order', 'completion_act']).default('work_order'),
  content: z.string().max(200000),
  isDefault: z.boolean().optional(),
  categoryId: z.preprocess(v => (v === '' ? null : v), z.string().max(100).nullable().optional()),
});
const templateUpdateSchema = templateSchema.omit({ type: true }).partial();

export const documentTemplateController = {
  async getAll(_req: Request, res: Response) {
    const templates = await prisma.documentTemplate.findMany({
      include: { category: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ data: templates });
  },

  async create(req: Request, res: Response) {
    const { name, type, content, isDefault, categoryId } = parse(templateSchema, req.body);
    // Шаблон по умолчанию у типа один: снятие флага с остальных и создание — одной транзакцией
    const template = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.documentTemplate.updateMany({ where: { type, isDefault: true }, data: { isDefault: false } });
      return tx.documentTemplate.create({
        data: { name, type, content, isDefault: !!isDefault, categoryId: categoryId ?? null },
        include: { category: true },
      });
    });
    res.status(201).json({ data: template });
  },

  async update(req: Request, res: Response) {
    const id = String(req.params.id);
    const data = parse(templateUpdateSchema, req.body);
    const existing = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!existing) throw new AppError('Шаблон не найден', 404);
    const template = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.documentTemplate.updateMany({
          where: { type: existing.type, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.documentTemplate.update({ where: { id }, data, include: { category: true } });
    });
    res.json({ data: template });
  },

  async delete(req: Request, res: Response) {
    await prisma.documentTemplate.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  },
};
