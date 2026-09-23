import fs from 'fs';
import path from 'path';
import { Prisma, WikiMediaType } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AuthPayload } from '../middleware/auth.middleware';
import { WIKI_MEDIA_DIR, WIKI_MEDIA_URL } from '../utils/uploads';

/** Кто проверяет правки вики и назначает за них премию. Их собственные правки на проверку не попадают. */
const REVIEWER_ROLES = ['Создатель', 'Директор', 'Менеджер'];

/** С 25-го числа начисления идут в следующий расчётный месяц — как в бухгалтерии (client/src/utils/salary.ts). */
const SALARY_PERIOD_START_DAY = 25;

export function isWikiReviewer(user: AuthPayload) {
  return user.isMaster || REVIEWER_ROLES.includes(user.role || '');
}

export interface WikiKey {
  markId: string;
  modelId: string;
  generationId: string;
}

interface MediaRef {
  id: string;
  type: WikiMediaType;
  filename: string;
  originalName: string;
}

export interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
  type: WikiMediaType;
}

const entryInclude = { media: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.WikiEntryInclude;

type EntryWithMedia = Prisma.WikiEntryGetPayload<{ include: typeof entryInclude }>;

function withUrls(entry: EntryWithMedia) {
  return {
    ...entry,
    media: entry.media.map(m => ({ ...m, url: `${WIKI_MEDIA_URL}/${m.filename}` })),
  };
}

function removeFile(filename: string) {
  fs.promises.unlink(path.join(WIKI_MEDIA_DIR, filename)).catch(() => {});
}

function generationLabel(g: { name: string; yearFrom: number | null; yearTo: number | null }) {
  if (!g.yearFrom) return g.name;
  return `${g.name} (${g.yearFrom}–${g.yearTo ?? 'н.в.'})`;
}

/** Названия берём из справочника: клиент присылает только id, подпись в карточке не подделать. */
export async function resolveCarNames(key: WikiKey) {
  const model = await prisma.carModel.findUnique({
    where: { markId_externalId: { markId: key.markId, externalId: key.modelId } },
    include: { mark: true },
  });
  if (!model) return null;
  const generation = await prisma.carGeneration.findUnique({
    where: { modelId_externalId: { modelId: model.id, externalId: key.generationId } },
  });
  if (!generation) return null;
  return { markName: model.mark.name, modelName: model.name, generationName: generationLabel(generation) };
}

async function getOrCreateEntry(key: WikiKey) {
  const existing = await prisma.wikiEntry.findUnique({ where: { markId_modelId_generationId: key } });
  if (existing) return existing;
  const names = await resolveCarNames(key);
  if (!names) throw new AppError('Автомобиль не найден в справочнике', 400);
  return prisma.wikiEntry.upsert({
    where: { markId_modelId_generationId: key },
    create: { ...key, ...names },
    update: {},
  });
}

function asMediaRefs(value: Prisma.JsonValue | null): MediaRef[] {
  return Array.isArray(value) ? (value as unknown as MediaRef[]) : [];
}

/**
 * Фиксирует правку сотрудника для проверки. Пока правка не проверена, всё, что автор
 * меняет в этой карточке, копится в одной записи — проверяющий видит итоговую разницу.
 */
async function trackRevision(
  entryId: string,
  user: AuthPayload,
  change: { prevContent?: string; newContent?: string; added?: MediaRef; removed?: MediaRef },
) {
  if (isWikiReviewer(user)) return;

  const pending = await prisma.wikiRevision.findFirst({
    where: { entryId, authorId: user.id, status: 'PENDING' },
  });

  const current = await prisma.wikiEntry.findUniqueOrThrow({ where: { id: entryId }, select: { content: true } });
  const prevContent = pending?.prevContent ?? change.prevContent ?? current.content;
  const newContent = change.newContent ?? pending?.newContent ?? current.content;
  let addedMedia = asMediaRefs(pending?.addedMedia ?? null);
  let removedMedia = asMediaRefs(pending?.removedMedia ?? null);

  if (change.added) addedMedia = [...addedMedia, change.added];
  if (change.removed) {
    // Удалил то, что сам же загрузил в этой правке, — для проверяющего этого файла как будто и не было
    const wasAdded = addedMedia.some(m => m.id === change.removed!.id);
    if (wasAdded) addedMedia = addedMedia.filter(m => m.id !== change.removed!.id);
    else removedMedia = [...removedMedia, change.removed];
  }

  const isEmpty = prevContent === newContent && addedMedia.length === 0 && removedMedia.length === 0;

  if (pending) {
    if (isEmpty) {
      await prisma.wikiRevision.delete({ where: { id: pending.id } });
      return;
    }
    await prisma.wikiRevision.update({
      where: { id: pending.id },
      data: {
        newContent,
        addedMedia: addedMedia as unknown as Prisma.InputJsonValue,
        removedMedia: removedMedia as unknown as Prisma.InputJsonValue,
        authorName: user.name,
      },
    });
    return;
  }

  if (isEmpty) return;
  await prisma.wikiRevision.create({
    data: {
      entryId,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role ?? null,
      prevContent,
      newContent,
      addedMedia: addedMedia as unknown as Prisma.InputJsonValue,
      removedMedia: removedMedia as unknown as Prisma.InputJsonValue,
    },
  });
}

function toRef(m: { id: string; type: WikiMediaType; filename: string; originalName: string }): MediaRef {
  return { id: m.id, type: m.type, filename: m.filename, originalName: m.originalName };
}

function currentSalaryMonth(now = new Date()) {
  const date = now.getDate() >= SALARY_PERIOD_START_DAY
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : now;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/**
 * Изменения вики выполняются строго по очереди. Когда выбирают сразу несколько файлов, запросы
 * приходят параллельно: без очереди первые из них одновременно создавали бы карточку
 * (конфликт уникального ключа) и заводили несколько правок на проверку вместо одной.
 * Сами операции — пара коротких запросов к БД (файл к этому моменту уже на диске), так что
 * общая очередь на один процесс сервера ничего не тормозит.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

export const wikiService = {
  async getEntry(key: WikiKey) {
    const entry = await prisma.wikiEntry.findUnique({
      where: { markId_modelId_generationId: key },
      include: entryInclude,
    });
    return entry ? withUrls(entry) : null;
  },

  /** Заполненные карточки — для списка «что уже есть в вики». */
  async listEntries() {
    const entries = await prisma.wikiEntry.findMany({
      orderBy: [{ markName: 'asc' }, { modelName: 'asc' }, { generationName: 'asc' }],
      select: {
        id: true, markId: true, modelId: true, generationId: true,
        markName: true, modelName: true, generationName: true,
        updatedAt: true, updatedByName: true,
        _count: { select: { media: true } },
        content: true,
      },
    });
    return entries
      .filter(e => e.content.trim() || e._count.media > 0)
      .map(({ content, _count, ...e }) => ({ ...e, mediaCount: _count.media, hasText: !!content.trim() }));
  },

  saveContent(key: WikiKey, content: string, user: AuthPayload) {
    return serialized(() => this.saveContentUnsafe(key, content, user));
  },

  async saveContentUnsafe(key: WikiKey, content: string, user: AuthPayload) {
    const entry = await getOrCreateEntry(key);
    const normalized = content.replace(/\r\n/g, '\n');
    if (normalized !== entry.content) {
      await prisma.wikiEntry.update({
        where: { id: entry.id },
        data: { content: normalized, updatedByName: user.name },
      });
      await trackRevision(entry.id, user, { prevContent: entry.content, newContent: normalized });
    }
    return this.getEntry(key);
  },

  addMedia(key: WikiKey, file: UploadedFile, user: AuthPayload) {
    return serialized(() => this.addMediaUnsafe(key, file, user));
  },

  async addMediaUnsafe(key: WikiKey, file: UploadedFile, user: AuthPayload) {
    let entry;
    try {
      entry = await getOrCreateEntry(key);
    } catch (e) {
      removeFile(file.filename);
      throw e;
    }
    const media = await prisma.wikiMedia.create({
      data: { entryId: entry.id, ...file, uploadedByName: user.name },
    });
    await prisma.wikiEntry.update({ where: { id: entry.id }, data: { updatedByName: user.name } });
    await trackRevision(entry.id, user, { added: toRef(media) });
    return { ...media, url: `${WIKI_MEDIA_URL}/${media.filename}` };
  },

  deleteMedia(mediaId: string, user: AuthPayload) {
    return serialized(() => this.deleteMediaUnsafe(mediaId, user));
  },

  async deleteMediaUnsafe(mediaId: string, user: AuthPayload) {
    const media = await prisma.wikiMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new AppError('Файл не найден', 404);
    await prisma.wikiMedia.delete({ where: { id: mediaId } });
    await prisma.wikiEntry.update({ where: { id: media.entryId }, data: { updatedByName: user.name } });
    await trackRevision(media.entryId, user, { removed: toRef(media) });
    // Файл с диска не удаляем, если на него ссылается правка на проверке — проверяющий должен его увидеть
    const referenced = await prisma.wikiRevision.count({
      where: { entryId: media.entryId, status: 'PENDING', removedMedia: { array_contains: [{ id: media.id }] } },
    });
    if (!referenced) removeFile(media.filename);
  },

  // --- Проверка правок ---

  async pendingCount() {
    return prisma.wikiRevision.count({ where: { status: 'PENDING' } });
  },

  async listRevisions(status: 'PENDING' | 'DONE') {
    const revisions = await prisma.wikiRevision.findMany({
      where: status === 'PENDING' ? { status: 'PENDING' } : { status: { in: ['REVIEWED', 'REWARDED'] } },
      orderBy: status === 'PENDING' ? { updatedAt: 'desc' } : { reviewedAt: 'desc' },
      take: status === 'PENDING' ? undefined : 100,
      include: {
        entry: {
          select: {
            markId: true, modelId: true, generationId: true,
            markName: true, modelName: true, generationName: true,
          },
        },
      },
    });
    return revisions.map(r => ({
      ...r,
      addedMedia: asMediaRefs(r.addedMedia).map(m => ({ ...m, url: `${WIKI_MEDIA_URL}/${m.filename}` })),
      removedMedia: asMediaRefs(r.removedMedia).map(m => ({ ...m, url: `${WIKI_MEDIA_URL}/${m.filename}` })),
    }));
  },

  async markReviewed(id: string, reviewer: AuthPayload) {
    const revision = await prisma.wikiRevision.findUnique({ where: { id } });
    if (!revision) throw new AppError('Правка не найдена', 404);
    if (revision.status !== 'PENDING') throw new AppError('Правка уже проверена', 400);
    await prisma.wikiRevision.update({
      where: { id },
      data: { status: 'REVIEWED', reviewedByName: reviewer.name, reviewedAt: new Date() },
    });
    await this.cleanupRemovedFiles(revision.id);
  },

  async reward(id: string, reviewer: AuthPayload) {
    const revision = await prisma.wikiRevision.findUnique({ where: { id }, include: { entry: true } });
    if (!revision) throw new AppError('Правка не найдена', 404);
    if (revision.status === 'REWARDED') throw new AppError('Премия за эту правку уже назначена', 400);

    const settings = await this.getSettings();
    if (!(settings.bonusAmount > 0)) {
      throw new AppError('Укажите размер премии в настройках вики', 400);
    }
    const author = await prisma.serviceman.findUnique({ where: { id: revision.authorId } });
    if (!author) throw new AppError('Сотрудник, внёсший правку, не найден', 400);

    const { year, month } = currentSalaryMonth();
    const { entry } = revision;
    const car = [entry.markName, entry.modelName, entry.generationName].filter(Boolean).join(' ');

    await prisma.$transaction(async tx => {
      const adjustment = await tx.salaryAdjustment.create({
        data: {
          servicemanName: author.name,
          type: 'BONUS',
          amount: settings.bonusAmount,
          reason: `Wiki: ${car}`,
          year,
          month,
        },
      });
      await tx.wikiRevision.update({
        where: { id },
        data: {
          status: 'REWARDED',
          reviewedByName: reviewer.name,
          reviewedAt: new Date(),
          bonusAmount: settings.bonusAmount,
          salaryAdjustmentId: adjustment.id,
        },
      });
    });
    await this.cleanupRemovedFiles(revision.id);
  },

  /** После проверки удалённые в правке файлы больше никому не нужны. */
  async cleanupRemovedFiles(revisionId: string) {
    const revision = await prisma.wikiRevision.findUnique({ where: { id: revisionId } });
    for (const m of asMediaRefs(revision?.removedMedia ?? null)) {
      const stillUsed = await prisma.wikiMedia.count({ where: { filename: m.filename } });
      if (!stillUsed) removeFile(m.filename);
    }
  },

  // --- Настройки ---

  async getSettings() {
    const existing = await prisma.wikiSettings.findFirst();
    return existing ?? prisma.wikiSettings.create({ data: {} });
  },

  async updateSettings(data: { bonusAmount: number }) {
    const settings = await this.getSettings();
    return prisma.wikiSettings.update({ where: { id: settings.id }, data });
  },
};
