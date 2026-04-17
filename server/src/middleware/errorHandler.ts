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

  console.error('[Unhandled Error]', err); // eslint-disable-line no-console
  res.status(500).json({
    error: true,
    message: 'Внутренняя ошибка сервера',
  });
}
