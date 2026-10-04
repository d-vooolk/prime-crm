import { Request, Response } from 'express';
import { z } from 'zod';
import { panicService } from '../services/panic.service';
import { parse } from '../middleware/validate';

const hiddenRecordsSchema = z.object({ pin: z.string().trim().max(100).default('') });

export const securityController = {
  /**
   * «Протокол AID» — тревожная кнопка (services/panic.service.ts).
   * Ответ при неверном PIN всегда одинаковый.
   */
  async hiddenRecords(req: Request, res: Response) {
    const { pin } = parse(hiddenRecordsSchema, req.body);
    const done = await panicService.trigger(pin, req.user!);
    res.json(done ? { data: [], done: true } : { data: [] });
  },
};
