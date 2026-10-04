/* eslint-disable no-console */
import { currentContext } from './requestContext';

/**
 * Логи сервера. В проде — одна JSON-строка на событие (docker logs, grep/jq по полям),
 * в разработке — читаемая строка. К каждой записи добавляется id запроса и пользователь.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (level === 'debug' && isProd) return;
  const ctx = currentContext();
  const data: Record<string, unknown> = { ...fields };
  if (data.err) data.err = serializeError(data.err);
  if (ctx?.requestId) data.requestId = ctx.requestId;
  if (ctx?.userName) data.user = ctx.userName;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (isProd) {
    out(JSON.stringify({ time: new Date().toISOString(), level, msg, ...data }));
  } else {
    const extra = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    out(`[${level}] ${msg}${extra}`);
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};
