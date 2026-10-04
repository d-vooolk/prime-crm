import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from './errorHandler';

/** Разбор данных запроса по схеме Zod: первая ошибка — понятным сообщением, детали — в details */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue?.message && !issue.message.startsWith('Expected') && !issue.message.startsWith('Required')
      ? issue.message
      : 'Некорректные данные';
    throw new AppError(message, 400, result.error.flatten());
  }
  return result.data;
}

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parse(schema, req.body);
      next();
    } catch (e) {
      next(e);
    }
  };
}

// ─── Общие кусочки схем ─────────────────────────────

/** Пустая строка → undefined (поле не задано) */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** Текст, который можно стереть: пустая строка или null → null */
export const nullableText = (max: number) => z.preprocess(
  v => (v === '' ? null : v),
  z.string().trim().max(max).nullable().optional(),
);

export const requiredText = (max: number, message: string) => z.string({ required_error: message }).trim().min(1, message).max(max);

/** Сумма денег: число ≥ 0 с не более чем двумя знаками (округляем) */
export const money = (message = 'Некорректная сумма') =>
  z.coerce.number({ invalid_type_error: message }).finite(message).min(0, message).transform(v => Math.round(v * 100) / 100);

export const positiveMoney = (message = 'Сумма должна быть больше нуля') =>
  z.coerce.number({ invalid_type_error: message }).finite(message).positive(message).transform(v => Math.round(v * 100) / 100);

export const percent = z.coerce.number().finite().min(0, 'Процент не может быть отрицательным').max(100, 'Процент не больше 100');

/** Дата в любом формате, который понимает Date; невалидная — ошибка, а не Invalid Date в базе */
export const dateString = (message = 'Некорректная дата') =>
  z.string({ required_error: message }).refine(v => !Number.isNaN(new Date(v).getTime()), message);

export const id = z.string().trim().min(1).max(100);
