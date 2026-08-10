import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';

/**
 * Синхронизация справочника авто со снапшотом донора.
 *
 * Живёт в src/, а не в scripts/, намеренно: прод-образ собирается с
 * `npm ci --omit=dev` и содержит только dist/ — ts-node там нет, и скрипт из
 * scripts/ внутри контейнера не запустить. Поэтому наполнение справочника
 * выполняется самим сервером при старте. Снапшот попадает в образ вместе с
 * папкой prisma (см. Dockerfile).
 *
 * ВАЖНО: синхронизация разностная и работает ТОЛЬКО с записями source=SNAPSHOT.
 * Всё, что заведено руками (source=MANUAL), не удаляется и не перезаписывается —
 * иначе добавленные грузовики стирались бы при каждом обновлении каталога.
 */

const SNAPSHOT = path.resolve(__dirname, '..', '..', 'prisma', 'data', 'cars-catalog.json');
const CHUNK = 5000;

interface SnapshotGeneration { id: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null }
interface SnapshotModel { id: string; name: string; yearFrom: number | null; yearTo: number | null; generations: SnapshotGeneration[] }
interface SnapshotMark { id: string; name: string; yearFrom: number | null; yearTo: number | null; logo: string | null; models: SnapshotModel[] }
export interface Snapshot {
  fetchedAt: string;
  counts: { marks: number; models: number; generations: number };
  marks: SnapshotMark[];
}

type MarkRow = { id: string; name: string; yearFrom: number | null; yearTo: number | null; logo: string | null };
type ModelRow = { id: string; externalId: string; markId: string; name: string; yearFrom: number | null; yearTo: number | null };
type GenerationRow = { id: string; externalId: string; modelId: string; name: string; yearFrom: number | null; yearTo: number | null; photo: string | null };

function log(msg: string) {
  console.log(`[car-catalog] ${msg}`); // eslint-disable-line no-console
}

export function readSnapshot(file = SNAPSHOT): Snapshot | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
  } catch (e) {
    log(`снапшот повреждён: ${(e as Error).message}`);
    return null;
  }
}

/** Разворачивает дерево снапшота в три плоских списка с детерминированными id. */
function flatten(snapshot: Snapshot) {
  const marks: MarkRow[] = [];
  const models: ModelRow[] = [];
  const generations: GenerationRow[] = [];

  for (const mark of snapshot.marks) {
    marks.push({ id: mark.id, name: mark.name, yearFrom: mark.yearFrom, yearTo: mark.yearTo, logo: mark.logo });
    for (const model of mark.models) {
      const modelUid = `${mark.id}/${model.id}`;
      models.push({
        id: modelUid, externalId: model.id, markId: mark.id,
        name: model.name, yearFrom: model.yearFrom, yearTo: model.yearTo,
      });
      for (const gen of model.generations) {
        generations.push({
          id: `${modelUid}/${gen.id}`, externalId: gen.id, modelId: modelUid,
          name: gen.name, yearFrom: gen.yearFrom, yearTo: gen.yearTo, photo: gen.photo,
        });
      }
    }
  }
  return { marks, models, generations };
}

async function chunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await fn(rows.slice(i, i + CHUNK));
}

/**
 * Приводит записи source=SNAPSHOT в соответствие со снапшотом.
 * Возвращает статистику проделанного.
 */
export async function syncCarCatalog(snapshot: Snapshot) {
  const want = flatten(snapshot);

  // --- поколения
  const haveGenerations = await prisma.carGeneration.findMany({
    where: { source: 'SNAPSHOT' }, select: { id: true },
  });
  const haveGenIds = new Set(haveGenerations.map(g => g.id));
  const wantGenIds = new Set(want.generations.map(g => g.id));
  const genToDelete = [...haveGenIds].filter(id => !wantGenIds.has(id));
  const genToInsert = want.generations.filter(g => !haveGenIds.has(g.id));

  // --- модели
  const haveModels = await prisma.carModel.findMany({
    where: { source: 'SNAPSHOT' }, select: { id: true },
  });
  const haveModelIds = new Set(haveModels.map(m => m.id));
  const wantModelIds = new Set(want.models.map(m => m.id));
  const modelToInsert = want.models.filter(m => !haveModelIds.has(m.id));
  let modelToDelete = [...haveModelIds].filter(id => !wantModelIds.has(id));

  // --- марки
  const haveMarks = await prisma.carMark.findMany({
    where: { source: 'SNAPSHOT' }, select: { id: true },
  });
  const haveMarkIds = new Set(haveMarks.map(m => m.id));
  const wantMarkIds = new Set(want.marks.map(m => m.id));
  const markToInsert = want.marks.filter(m => !haveMarkIds.has(m.id));
  let markToDelete = [...haveMarkIds].filter(id => !wantMarkIds.has(id));

  // Донор мог выкинуть марку/модель, под которой у нас висят ручные записи.
  // Удаление каскадом снесло бы их — поэтому такие родители остаются жить.
  const protectedModels = modelToDelete.length
    ? await prisma.carModel.findMany({
      where: { id: { in: modelToDelete }, generations: { some: { source: 'MANUAL' } } },
      select: { id: true },
    })
    : [];
  const protectedMarks = markToDelete.length
    ? await prisma.carMark.findMany({
      where: { id: { in: markToDelete }, models: { some: { source: 'MANUAL' } } },
      select: { id: true },
    })
    : [];

  if (protectedModels.length || protectedMarks.length) {
    const keepModels = new Set(protectedModels.map(m => m.id));
    const keepMarks = new Set(protectedMarks.map(m => m.id));
    modelToDelete = modelToDelete.filter(id => !keepModels.has(id));
    markToDelete = markToDelete.filter(id => !keepMarks.has(id));
    log(`оставлены исчезнувшие у донора записи с ручными потомками: марок ${keepMarks.size}, моделей ${keepModels.size}`);
  }

  // Порядок важен: сначала листья, потом родители.
  await chunked(genToDelete, ids => prisma.carGeneration.deleteMany({ where: { id: { in: ids } } }));
  await chunked(modelToDelete, ids => prisma.carModel.deleteMany({ where: { id: { in: ids } } }));
  await chunked(markToDelete, ids => prisma.carMark.deleteMany({ where: { id: { in: ids } } }));

  await chunked(markToInsert, data => prisma.carMark.createMany({ data, skipDuplicates: true }));
  await chunked(modelToInsert, data => prisma.carModel.createMany({ data, skipDuplicates: true }));
  await chunked(genToInsert, data => prisma.carGeneration.createMany({ data, skipDuplicates: true }));

  return {
    added: { marks: markToInsert.length, models: modelToInsert.length, generations: genToInsert.length },
    removed: { marks: markToDelete.length, models: modelToDelete.length, generations: genToDelete.length },
  };
}

/**
 * Вызывается при старте сервера. Если справочник уже соответствует снапшоту —
 * не делает ничего. Никогда не бросает: пустой справочник не повод не поднять API.
 */
export async function syncCarCatalogIfNeeded() {
  try {
    const snapshot = readSnapshot();
    if (!snapshot) {
      log(`снапшот не найден (${SNAPSHOT}) — справочник останется как есть`);
      return;
    }

    // Сверять счётчики бессмысленно: марка донора, сохранённая ради ручных
    // потомков, навсегда сделала бы их неравными. Разностный проход дешёвый —
    // три выборки идентификаторов и сравнение множеств, — поэтому гоняем всегда.
    const started = Date.now();
    const res = await syncCarCatalog(snapshot);
    const changed = res.added.marks + res.added.models + res.added.generations
      + res.removed.marks + res.removed.models + res.removed.generations;

    const manual = await prisma.carMark.count({ where: { source: 'MANUAL' } });
    const manualNote = manual ? `, плюс ${manual} ручных марок` : '';

    if (!changed) {
      log(`актуален: ${snapshot.counts.marks}/${snapshot.counts.models}/${snapshot.counts.generations} из снапшота${manualNote}`);
      return;
    }

    log(
      `синхронизировано за ${((Date.now() - started) / 1000).toFixed(1)} с${manualNote}` +
      ` | добавлено ${res.added.marks}/${res.added.models}/${res.added.generations}` +
      ` | удалено ${res.removed.marks}/${res.removed.models}/${res.removed.generations}`,
    );
  } catch (e) {
    log(`не удалось синхронизировать справочник: ${(e as Error).message}`);
  }
}
