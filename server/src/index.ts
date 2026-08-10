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
import { seedCarCatalogIfNeeded } from './bootstrap/carCatalog';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiRouter);

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`); // eslint-disable-line no-console
  // Справочник авто наполняется здесь, а не в deploy.sh: в прод-образе нет
  // ts-node, поэтому запустить скрипт из scripts/ внутри контейнера нельзя.
  await seedCarCatalogIfNeeded();
});

// Проверка напоминаний каждые 5 минут
setInterval(() => smsService.runReminderCheck(), 5 * 60 * 1000);
