/**
 * Заливка снапшота каталога авто в БД.
 *
 *   npm run cars:seed
 *
 * Идемпотентно: полностью заменяет содержимое справочника. Идентификаторы
 * моделей и поколений детерминированные ("markId/externalId"), поэтому повторный
 * запуск даёт ровно тот же результат.
 *
 * Справочник ни на что не ссылается и на него никто не ссылается по внешнему
 * ключу — в Car лежат просто строковые id, так что перезалив безопасен.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', `.env.${process.env.NODE_ENV || 'development'}`),
});

import { prisma } from '../src/prisma/client';

const SNAPSHOT = path.resolve(__dirname, '..', 'prisma', 'data', 'cars-catalog.json');
const CHUNK = 5000;

interface SnapshotGeneration { id: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null }
interface SnapshotModel { id: string; name: string; yearFrom: number | null; yearTo: number | null; generations: SnapshotGeneration[] }
interface SnapshotMark { id: string; name: string; yearFrom: number | null; yearTo: number | null; logo: string | null; models: SnapshotModel[] }
interface Snapshot {
  source: string;
  fetchedAt: string;
  counts: { marks: number; models: number; generations: number };
  marks: SnapshotMark[];
}

function log(msg: string) {
  console.log(msg); // eslint-disable-line no-console
}

async function insertChunked<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
    log(`  ${label}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
}

async function main() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`Снапшот не найден: ${SNAPSHOT}\nСначала выполните: npm run cars:fetch`); // eslint-disable-line no-console
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as Snapshot;
  log(`Снапшот от ${snapshot.fetchedAt}`);
  log(`В файле: марок ${snapshot.counts.marks}, моделей ${snapshot.counts.models}, поколений ${snapshot.counts.generations}`);

  const markRows = snapshot.marks.map(m => ({
    id: m.id,
    name: m.name,
    yearFrom: m.yearFrom,
    yearTo: m.yearTo,
    logo: m.logo,
  }));

  const modelRows: Array<{ id: string; externalId: string; markId: string; name: string; yearFrom: number | null; yearTo: number | null }> = [];
  const generationRows: Array<{ id: string; externalId: string; modelId: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null }> = [];

  for (const mark of snapshot.marks) {
    for (const model of mark.models) {
      const modelUid = `${mark.id}/${model.id}`;
      modelRows.push({
        id: modelUid,
        externalId: model.id,
        markId: mark.id,
        name: model.name,
        yearFrom: model.yearFrom,
        yearTo: model.yearTo,
      });
      for (const gen of model.generations) {
        generationRows.push({
          id: `${modelUid}/${gen.id}`,
          externalId: gen.id,
          modelId: modelUid,
          name: gen.name,
          yearFrom: gen.yearFrom,
          yearTo: gen.yearTo,
          photo: gen.photo,
        });
      }
    }
  }

  log('Очистка старого справочника...');
  await prisma.carGeneration.deleteMany();
  await prisma.carModel.deleteMany();
  await prisma.carMark.deleteMany();

  log('Заливка...');
  await insertChunked('марки', markRows, chunk => prisma.carMark.createMany({ data: chunk }));
  await insertChunked('модели', modelRows, chunk => prisma.carModel.createMany({ data: chunk }));
  await insertChunked('поколения', generationRows, chunk => prisma.carGeneration.createMany({ data: chunk }));

  const [marks, models, generations] = await Promise.all([
    prisma.carMark.count(),
    prisma.carModel.count(),
    prisma.carGeneration.count(),
  ]);
  log(`Готово. В базе: марок ${marks}, моделей ${models}, поколений ${generations}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e); // eslint-disable-line no-console
  await prisma.$disconnect();
  process.exit(1);
});
