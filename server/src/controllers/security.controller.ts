import { Request, Response } from 'express';
import { z } from 'zod';
import { panicService } from '../services/panic.service';
import { parse } from '../middleware/validate';

const hiddenRecordsSchema = z.object({ pin: z.string().trim().max(100).default('') });

export const securityController = {
  /**
   * «Протокол AID» — тревожная кнопка (services/panic.service.ts).
   *
   * Ответ — поток NDJSON: по строке на шаг перехода ({ done, total, label }) для прогрессбара,
   * последней строкой — { finished: true } при успехе или { finished: false } иначе. При неверном
   * PIN шагов нет, сразу { finished: false } — снаружи успех и неудача неотличимы, как и раньше.
   */
  async hiddenRecords(req: Request, res: Response) {
    const { pin } = parse(hiddenRecordsSchema, req.body);

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx не должен копить поток в буфере

    const write = (obj: unknown) => res.write(`${JSON.stringify(obj)}\n`);

    const done = await panicService.trigger(pin, req.user!, {
      propagate: true,
      onProgress: p => write(p),
    });

    write({ finished: done });
    res.end();
  },
};
