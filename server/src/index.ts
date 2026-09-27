import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { smsService } from './services/sms.service';
import { syncCarCatalogIfNeeded } from './bootstrap/carCatalog';
import { importLegacyWikiIfPresent } from './bootstrap/wikiLegacyImport';
import { generateMissingWikiVariants } from './bootstrap/wikiImageVariants';
import { linkFounderSalariesToCash } from './bootstrap/founderSalaryLinks';
import { backfillServicemanPerformers } from './bootstrap/servicemanPerformers';
import { seedExpenseCategoriesIfEmpty } from './bootstrap/expenseCategories';
import { UPLOADS_DIR, ensureUploadDirs } from './utils/uploads';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureUploadDirs();
// Загруженные файлы (фото и видео вики). Имена случайные, поэтому раздаются без авторизации —
// иначе <img>/<video> не смогли бы их показать. Идёт через тот же /api/, что проксирует nginx.
// Файлы никогда не перезаписываются (случайные имена, у сжатых вариантов в имени версия),
// поэтому браузер может держать их в кеше год и не перепроверять.
app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '365d', immutable: true, index: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiRouter);

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`); // eslint-disable-line no-console
  // Справочник авто наполняется здесь, а не в deploy.sh: в прод-образе нет
  // ts-node, поэтому запустить скрипт из scripts/ внутри контейнера нельзя.
  await syncCarCatalogIfNeeded();
  // После справочника: импорт сверяет карточки старой вики с марками и поколениями
  await importLegacyWikiIfPresent();
  // Сжатие старых фото вики — в фоне и по одному, старт не ждёт
  void generateMissingWikiVariants();
  await linkFounderSalariesToCash();
  await backfillServicemanPerformers();
  await seedExpenseCategoriesIfEmpty();
});

// Проверка напоминаний каждые 5 минут
setInterval(() => smsService.runReminderCheck(), 5 * 60 * 1000);
