import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { smsService } from './services/sms.service';
import { syncCarCatalogIfNeeded } from './bootstrap/carCatalog';
import { importLegacyWikiIfPresent } from './bootstrap/wikiLegacyImport';
import { generateMissingWikiVariants } from './bootstrap/wikiImageVariants';
import { linkFounderSalariesToCash } from './bootstrap/founderSalaryLinks';
import { backfillServicemanPerformers } from './bootstrap/servicemanPerformers';
import { seedExpenseCategoriesIfEmpty } from './bootstrap/expenseCategories';
import { recordMediaService } from './services/recordMedia.service';
import { sendDueNoteReminders } from './services/noteReminders';
import { UPLOADS_DIR, ensureUploadDirs } from './utils/uploads';
import { assertEnv, env } from './config/env';
import { prisma } from './prisma/client';
import { logger } from './utils/logger';
import { requestContext } from './utils/requestContext';

assertEnv();

const app = express();

// Сервер слушает только 127.0.0.1 за nginx — IP клиента берём из X-Forwarded-For
// (нужно ограничению попыток входа). Доверяем только локальным и docker-адресам.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Контекст запроса (id, пользователь) для логов и журнала изменений + лог каждого запроса к API
app.use((req, res, next) => {
  const requestId = crypto.randomBytes(6).toString('hex');
  const started = Date.now();
  requestContext.run({ requestId }, () => {
    res.on('finish', () => {
      if (req.path.startsWith('/api/uploads') || req.path === '/health') return;
      const fields = { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - started };
      if (res.statusCode >= 500) logger.error('request', fields);
      else if (res.statusCode >= 400) logger.warn('request', fields);
      else logger.info('request', fields);
    });
    next();
  });
});

ensureUploadDirs();
// Загруженные файлы (фото и видео вики и записей). Имена случайные, поэтому раздаются без
// авторизации — иначе <img>/<video> не смогли бы их показать. Файлы никогда не перезаписываются,
// браузер может кешировать их год. Песочница CSP и nosniff: даже если под видом фото
// загрузили бы HTML или SVG со скриптом, браузер его не выполнит.
app.use('/api/uploads', (_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(UPLOADS_DIR, { maxAge: '365d', immutable: true, index: false, dotfiles: 'deny' }));

// Проверка живости вместе с базой: healthcheck docker перезапустит сервер, если база недоступна
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('health: база недоступна', { err });
    res.status(503).json({ status: 'db_unavailable' });
  }
});
app.use('/api', apiRouter);

app.use(errorHandler);

/** Фоновая задача: ошибка пишется в лог, но не роняет процесс */
async function runSafely(name: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    logger.error(`Фоновая задача «${name}» завершилась с ошибкой`, { err });
  }
}

app.listen(env.port, async () => {
  logger.info(`Server running on http://localhost:${env.port}`);
  // Справочник авто наполняется здесь, а не в deploy.sh: в прод-образе нет
  // ts-node, поэтому запустить скрипт из scripts/ внутри контейнера нельзя.
  await runSafely('справочник авто', syncCarCatalogIfNeeded);
  // После справочника: импорт сверяет карточки старой вики с марками и поколениями
  await runSafely('импорт старой вики', importLegacyWikiIfPresent);
  // Сжатие старых фото вики — в фоне и по одному, старт не ждёт
  void runSafely('сжатие фото вики', generateMissingWikiVariants);
  await runSafely('привязка ЗП учредителей', linkFounderSalariesToCash);
  await runSafely('исполнители работ', backfillServicemanPerformers);
  await runSafely('категории расходов', seedExpenseCategoriesIfEmpty);
  void runSafely('очистка старых медиа записей', () => recordMediaService.deleteExpired());
});

// Проверка напоминаний каждые 5 минут
setInterval(() => void runSafely('SMS-напоминания', () => smsService.runReminderCheck()), 5 * 60 * 1000);
// Напоминания заметок пушем — проверка каждую минуту
setInterval(() => void runSafely('напоминания заметок', () => sendDueNoteReminders()), 60 * 1000);
// Фото и видео записей хранятся год — раз в сутки удаляем просроченные
setInterval(() => void runSafely('очистка старых медиа записей', () => recordMediaService.deleteExpired()), 24 * 60 * 60 * 1000);

process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { err: reason }));
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { err });
  process.exit(1);
});
