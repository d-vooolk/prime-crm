import { Request, Response } from 'express';
import { z } from 'zod';
import { vdfCapitalService } from '../services/accounting/vdfCapital.service';
import { FOREIGN_CURRENCIES } from '../services/currency.service';
import { parse, positiveMoney, dateString, requiredText, optionalText } from '../middleware/validate';

const ref = z.string().trim().min(1).max(100);

const depositSchema = z.object({
  ref,
  currency: z.enum(FOREIGN_CURRENCIES),
  amount: positiveMoney(),
  rate: z.coerce.number().finite().positive('Некорректный курс').max(1000, 'Некорректный курс'),
  date: dateString(),
  description: requiredText(300, 'Нет описания'),
  person: optionalText(150),
});

export const vdfCapitalController = {
  /** Магазин присылает валюту, полученную по долгу, — пополнение капитала (вход по ключу) */
  async receive(req: Request, res: Response) {
    const deposit = parse(depositSchema, req.body);
    const saved = await vdfCapitalService.receive(deposit);
    res.json({ data: { id: saved.id } });
  },

  /** Магазин отозвал погашение — пополнение удаляется (вход по ключу) */
  async revoke(req: Request, res: Response) {
    res.json({ data: { removed: await vdfCapitalService.revoke(parse(ref, req.params.ref)) } });
  },
};
