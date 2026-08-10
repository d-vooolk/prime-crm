/**
 * Ручная заливка снапшота каталога авто в БД.
 *
 *   npm run cars:seed
 *
 * Нужен для локальной работы. На проде то же самое делает сам сервер при
 * старте (src/bootstrap/carCatalog.ts) — там нет ts-node, чтобы гонять скрипты.
 * Логика общая, чтобы не разъезжалась.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

import { prisma } from '../src/prisma/client';
import { syncCarCatalog } from '../src/bootstrap/carCatalog';

const SNAPSHOT = path.resolve(__dirname, '..', 'prisma', 'data', 'cars-catalog.json');

function log(msg: string) {
  console.log(msg); // eslint-disable-line no-console
}

async function main() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`Снапшот не найден: ${SNAPSHOT}\nСначала выполните: npm run cars:fetch`); // eslint-disable-line no-console
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  log(`Снапшот от ${snapshot.fetchedAt}`);
  log(`В файле: марок ${snapshot.counts.marks}, моделей ${snapshot.counts.models}, поколений ${snapshot.counts.generations}`);

  log('Синхронизация (записи, заведённые руками, не затрагиваются)...');
  const res = await syncCarCatalog(snapshot);
  log(`Добавлено: марок ${res.added.marks}, моделей ${res.added.models}, поколений ${res.added.generations}`);
  log(`Удалено:   марок ${res.removed.marks}, моделей ${res.removed.models}, поколений ${res.removed.generations}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e); // eslint-disable-line no-console
  await prisma.$disconnect();
  process.exit(1);
});
