import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Ошибка Prisma с кодом вида P2002 — проверяем структурно, без привязки к версии клиента. */
function asPrismaError(err: unknown): { code: string; meta?: { target?: unknown } } | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  return typeof e.code === 'string' && /^P\d{4}$/.test(e.code)
    ? { code: e.code, meta: e.meta }
    : null;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
      details: err.details,
    });
    return;
  }

  const prismaError = asPrismaError(err);
  if (prismaError) {
    const target = Array.isArray(prismaError.meta?.target)
      ? (prismaError.meta.target as string[]).join(', ')
      : undefined;
    const known: Record<string, { status: number; message: string }> = {
      P2002: {
        status: 409,
        message: target
          ? `Запись с таким значением уже существует (${target})`
          : 'Такая запись уже существует',
      },
      P2003: { status: 400, message: 'Запись связана с другими данными' },
      P2025: { status: 404, message: 'Запись не найдена' },
    };
    const mapped = known[prismaError.code];
    if (mapped) {
      console.error('[Prisma Error]', prismaError.code, prismaError.meta); // eslint-disable-line no-console
      res.status(mapped.status).json({ error: true, message: mapped.message });
      return;
    }
  }

  console.error('[Unhandled Error]', err); // eslint-disable-line no-console
  res.status(500).json({
    error: true,
    message: 'Внутренняя ошибка сервера',
  });
}
