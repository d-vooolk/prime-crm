import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';

/**
 * Заливка справочника авто из снапшота.
 *
 * Живёт в src/, а не в scripts/, намеренно: прод-образ собирается с
 * `npm ci --omit=dev` и содержит только dist/ — ts-node там нет, и скрипт из
 * scripts/ внутри контейнера не запустить. Поэтому наполнение справочника
 * выполняется самим сервером при старте.
 *
 * Снапшот попадает в образ вместе с папкой prisma (см. Dockerfile).
 */

const SNAPSHOT = path.resolve(__dirname, '..', '..', 'prisma', 'data', 'cars-catalog.json');
const CHUNK = 5000;

interface SnapshotGeneration { id: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null }
interface SnapshotModel { id: string; name: string; yearFrom: number | null; yearTo: number | null; generations: SnapshotGeneration[] }
interface SnapshotMark { id: string; name: string; yearFrom: number | null; yearTo: number | null; logo: string | null; models: SnapshotModel[] }
interface Snapshot {
  fetchedAt: string;
  counts: { marks: number; models: number; generations: number };
  marks: SnapshotMark[];
}

function log(msg: string) {
  console.log(`[car-catalog] ${msg}`); // eslint-disable-line no-console
}

function readSnapshot(): Snapshot | null {
  if (!fs.existsSync(SNAPSHOT)) return null;
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as Snapshot;
  } catch (e) {
    log(`снапшот повреждён: ${(e as Error).message}`);
    return null;
  }
}

async function currentCounts() {
  const [marks, models, generations] = await Promise.all([
    prisma.carMark.count(),
    prisma.carModel.count(),
    prisma.carGeneration.count(),
  ]);
  return { marks, models, generations };
}

/** Полная перезаливка. Идемпотентна: идентификаторы детерминированные. */
export async function seedCarCatalog(snapshot: Snapshot) {
  const markRows = snapshot.marks.map(m => ({
    id: m.id, name: m.name, yearFrom: m.yearFrom, yearTo: m.yearTo, logo: m.logo,
  }));

  const modelRows: Array<{ id: string; externalId: string; markId: string; name: string; yearFrom: number | null; yearTo: number | null }> = [];
  const generationRows: Array<{ id: string; externalId: string; modelId: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null }> = [];

  for (const mark of snapshot.marks) {
    for (const model of mark.models) {
      const modelUid = `${mark.id}/${model.id}`;
      modelRows.push({
        id: modelUid, externalId: model.id, markId: mark.id,
        name: model.name, yearFrom: model.yearFrom, yearTo: model.yearTo,
      });
      for (const gen of model.generations) {
        generationRows.push({
          id: `${modelUid}/${gen.id}`, externalId: gen.id, modelId: modelUid,
          name: gen.name, yearFrom: gen.yearFrom, yearTo: gen.yearTo, photo: gen.photo,
        });
      }
    }
  }

  await prisma.carGeneration.deleteMany();
  await prisma.carModel.deleteMany();
  await prisma.carMark.deleteMany();

  for (let i = 0; i < markRows.length; i += CHUNK) {
    await prisma.carMark.createMany({ data: markRows.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < modelRows.length; i += CHUNK) {
    await prisma.carModel.createMany({ data: modelRows.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < generationRows.length; i += CHUNK) {
    await prisma.carGeneration.createMany({ data: generationRows.slice(i, i + CHUNK) });
  }

  return { marks: markRows.length, models: modelRows.length, generations: generationRows.length };
}

/**
 * Вызывается при старте сервера. Заливает справочник, только если в базе
 * не то, что в снапшоте, — на обычном рестарте не делает ничего лишнего.
 * Никогда не бросает: пустой справочник не повод не поднимать API.
 */
export async function seedCarCatalogIfNeeded() {
  try {
    const snapshot = readSnapshot();
    if (!snapshot) {
      log(`снапшот не найден (${SNAPSHOT}) — справочник останется как есть`);
      return;
    }

    const db = await currentCounts();
    const want = snapshot.counts;
    if (db.marks === want.marks && db.models === want.models && db.generations === want.generations) {
      log(`актуален: марок ${db.marks}, моделей ${db.models}, поколений ${db.generations}`);
      return;
    }

    log(`в базе ${db.marks}/${db.models}/${db.generations}, в снапшоте ${want.marks}/${want.models}/${want.generations} — заливаю`);
    const started = Date.now();
    const res = await seedCarCatalog(snapshot);
    log(`залито за ${((Date.now() - started) / 1000).toFixed(1)} с: марок ${res.marks}, моделей ${res.models}, поколений ${res.generations}`);
  } catch (e) {
    log(`не удалось залить справочник: ${(e as Error).message}`);
  }
}
