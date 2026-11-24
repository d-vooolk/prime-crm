import fs from 'fs';
import path from 'path';
import { Prisma, WikiMediaType } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AuthPayload } from '../middleware/auth.middleware';
import { WIKI_MEDIA_DIR, WIKI_MEDIA_URL } from '../utils/uploads';
import { ImageVariants, removeVariants, variantUrl } from '../utils/wikiImages';
import { vdfCatalogService } from './vdfCatalog.service';
import { pushService, pushInBackground } from './push.service';
import { appendProposalText } from './wikiProposals.logic';

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

/** Замечание проверяющего: что доработать */
interface ReviewNote {
  text: string;
  byName: string;
  at: string;
}

/** Правка ещё у автора: ждёт проверки или доработки — в неё копятся новые изменения */
export const OPEN_STATUSES = ['PENDING', 'CHANGES_REQUESTED'] as const;

export interface MediaRef {
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
  variants?: ImageVariants;
}

// Файлы и товары из предложений оптовиков (revisionId) не видны, пока правку не приняли
const entryInclude = {
  media: { where: { revisionId: null }, orderBy: { createdAt: 'asc' } },
  sections: { select: { sectionId: true, content: true, updatedByName: true, updatedAt: true } },
  products: { where: { revisionId: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.WikiEntryInclude;

type EntryWithMedia = Prisma.WikiEntryGetPayload<{ include: typeof entryInclude }>;

type MediaRow = Prisma.WikiMediaGetPayload<object>;

/** Ссылки на оригинал и сжатые варианты. Нет варианта — null, фронт возьмёт оригинал. */
export function mediaWithUrls(m: MediaRow) {
  const { thumbFilename, mediumFilename, displayFilename, ...rest } = m;
  return {
    ...rest,
    // HEIC браузер не покажет — вместо него полноразмерный JPEG
    url: variantUrl(displayFilename) ?? `${WIKI_MEDIA_URL}/${m.filename}`,
    thumbUrl: variantUrl(thumbFilename),
    mediumUrl: variantUrl(mediumFilename),
  };
}

function withUrls(entry: EntryWithMedia) {
  return { ...entry, media: entry.media.map(mediaWithUrls) };
}

/** Удаляет оригинал вместе со сжатыми вариантами. */
export function removeFile(filename: string) {
  fs.promises.unlink(path.join(WIKI_MEDIA_DIR, filename)).catch(() => {});
  void removeVariants(filename);
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

export async function getOrCreateEntry(key: WikiKey) {
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

/** Раздел карточки; null — «Общее» (WikiEntry.content) */
export type SectionId = string | null;

export async function assertSection(sectionId: SectionId) {
  if (sectionId && !(await prisma.wikiSection.findUnique({ where: { id: sectionId } }))) {
    throw new AppError('Раздел вики не найден', 400);
  }
}

export async function readContent(entryId: string, sectionId: SectionId) {
  if (!sectionId) {
    return (await prisma.wikiEntry.findUniqueOrThrow({ where: { id: entryId }, select: { content: true } })).content;
  }
  const row = await prisma.wikiEntrySection.findUnique({
    where: { entryId_sectionId: { entryId, sectionId } },
    select: { content: true },
  });
  return row?.content ?? '';
}

export function asMediaRefs(value: Prisma.JsonValue | null): MediaRef[] {
  return Array.isArray(value) ? (value as unknown as MediaRef[]) : [];
}

export function asReviewNotes(value: Prisma.JsonValue | null): ReviewNote[] {
  return Array.isArray(value) ? (value as unknown as ReviewNote[]) : [];
}

export const revisionEntrySelect = {
  markId: true, modelId: true, generationId: true,
  markName: true, modelName: true, generationName: true,
} as const;

/** Ссылка сразу на раздел карточки — для пуша автору */
function wikiUrl(entry: WikiKey, sectionId: SectionId) {
  const params = new URLSearchParams({ mark: entry.markId, model: entry.modelId, generation: entry.generationId });
  if (sectionId) params.set('section', sectionId);
  return `/wiki?${params}`;
}

/**
 * Фиксирует правку сотрудника для проверки. Пока правка не проверена, всё, что автор
 * меняет в этом разделе карточки, копится в одной записи — проверяющий видит итоговую разницу.
 * Разделы — отдельные правки: премия за вики и упущенная прибыль считаются по разделам.
 */
async function trackRevision(
  entryId: string,
  sectionId: SectionId,
  user: AuthPayload,
  change: { prevContent?: string; newContent?: string; added?: MediaRef; removed?: MediaRef },
) {
  if (isWikiReviewer(user)) return;

  const pending = await prisma.wikiRevision.findFirst({
    where: { entryId, sectionId, authorId: user.id, status: { in: [...OPEN_STATUSES] } },
  });

  const current = await readContent(entryId, sectionId);
  const prevContent = pending?.prevContent ?? change.prevContent ?? current;
  const newContent = change.newContent ?? pending?.newContent ?? current;
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
    // На доработке правку не удаляем, даже если автор всё откатил: замечание должно остаться
    if (isEmpty && pending.status === 'PENDING') {
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
      sectionId,
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

export function toRef(m: { id: string; type: WikiMediaType; filename: string; originalName: string }): MediaRef {
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

export function serialized<T>(fn: () => Promise<T>): Promise<T> {
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
        _count: { select: { media: { where: { revisionId: null } } } },
        content: true,
        sections: { select: { content: true } },
      },
    });
    return entries
      .map(({ content, sections, _count, ...e }) => ({
        ...e,
        mediaCount: _count.media,
        hasText: !!content.trim() || sections.some(s => s.content.trim()),
      }))
      .filter(e => e.hasText || e.mediaCount > 0);
  },

  saveContent(key: WikiKey, sectionId: SectionId, content: string, user: AuthPayload) {
    return serialized(() => this.saveContentUnsafe(key, sectionId, content, user));
  },

  async saveContentUnsafe(key: WikiKey, sectionId: SectionId, content: string, user: AuthPayload) {
    await assertSection(sectionId);
    const entry = await getOrCreateEntry(key);
    const normalized = content.replace(/\r\n/g, '\n');
    const prev = await readContent(entry.id, sectionId);
    if (normalized !== prev) {
      await prisma.$transaction(async tx => {
        if (sectionId) {
          await tx.wikiEntrySection.upsert({
            where: { entryId_sectionId: { entryId: entry.id, sectionId } },
            create: { entryId: entry.id, sectionId, content: normalized, updatedByName: user.name },
            update: { content: normalized, updatedByName: user.name },
          });
        }
        await tx.wikiEntry.update({
          where: { id: entry.id },
          data: { ...(sectionId ? {} : { content: normalized }), updatedByName: user.name },
        });
      });
      await trackRevision(entry.id, sectionId, user, { prevContent: prev, newContent: normalized });
    }
    return this.getEntry(key);
  },

  addMedia(key: WikiKey, sectionId: SectionId, file: UploadedFile, user: AuthPayload) {
    return serialized(() => this.addMediaUnsafe(key, sectionId, file, user));
  },

  async addMediaUnsafe(key: WikiKey, sectionId: SectionId, file: UploadedFile, user: AuthPayload) {
    let entry;
    try {
      await assertSection(sectionId);
      entry = await getOrCreateEntry(key);
    } catch (e) {
      removeFile(file.filename);
      throw e;
    }
    const { variants, ...fileData } = file;
    const media = await prisma.wikiMedia.create({
      data: { entryId: entry.id, sectionId, ...fileData, ...variants, uploadedByName: user.name },
    });
    await prisma.wikiEntry.update({ where: { id: entry.id }, data: { updatedByName: user.name } });
    await trackRevision(entry.id, sectionId, user, { added: toRef(media) });
    return mediaWithUrls(media);
  },

  deleteMedia(mediaId: string, user: AuthPayload) {
    return serialized(() => this.deleteMediaUnsafe(mediaId, user));
  },

  async deleteMediaUnsafe(mediaId: string, user: AuthPayload) {
    const media = await prisma.wikiMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new AppError('Файл не найден', 404);
    await prisma.wikiMedia.delete({ where: { id: mediaId } });
    await prisma.wikiEntry.update({ where: { id: media.entryId }, data: { updatedByName: user.name } });
    await trackRevision(media.entryId, media.sectionId, user, { removed: toRef(media) });
    // Файл с диска не удаляем, если на него ссылается правка на проверке — проверяющий должен его увидеть
    const referenced = await prisma.wikiRevision.count({
      where: { entryId: media.entryId, status: { in: [...OPEN_STATUSES] }, removedMedia: { array_contains: [{ id: media.id }] } },
    });
    if (!referenced) removeFile(media.filename);
  },

  // --- Товары vdf.by ---

  /** Название, ссылку и картинку берём у магазина по id: клиент присылает только id товара */
  async addProduct(key: WikiKey, sectionId: SectionId, productId: string, user: AuthPayload) {
    await assertSection(sectionId);
    const product = await vdfCatalogService.byId(productId);
    if (!product) throw new AppError('Товар не найден в каталоге vdf.by', 404);
    const entry = await getOrCreateEntry(key);
    const existing = await prisma.wikiProduct.findFirst({ where: { entryId: entry.id, sectionId, productId } });
    if (!existing) {
      await prisma.wikiProduct.create({
        data: {
          entryId: entry.id,
          sectionId,
          productId,
          title: product.title,
          url: product.url,
          imageUrl: product.image,
          addedByName: user.name,
        },
      });
    }
    return this.getEntry(key);
  },

  async removeProduct(id: string) {
    const product = await prisma.wikiProduct.findUnique({ where: { id } });
    if (!product) throw new AppError('Товар уже откреплён', 404);
    await prisma.wikiProduct.delete({ where: { id } });
  },

  // --- Проверка правок ---

  async pendingCount() {
    return prisma.wikiRevision.count({ where: { status: 'PENDING' } });
  },

  /** Правки сотрудника, возвращённые ему на доработку — счётчик в меню */
  async reworkCount(user: AuthPayload) {
    return prisma.wikiRevision.count({ where: { authorId: user.id, status: 'CHANGES_REQUESTED' } });
  },

  /** Возвращённые сотруднику правки: где и что доработать */
  async listRework(user: AuthPayload) {
    const revisions = await prisma.wikiRevision.findMany({
      where: { authorId: user.id, status: 'CHANGES_REQUESTED' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, sectionId: true, reviewNotes: true, updatedAt: true,
        entry: { select: revisionEntrySelect },
        section: { select: { name: true } },
      },
    });
    return revisions.map(({ section, reviewNotes, ...r }) => ({
      ...r,
      sectionName: section?.name ?? null,
      reviewNotes: asReviewNotes(reviewNotes),
    }));
  },

  async listRevisions(status: 'PENDING' | 'REWORK' | 'DONE') {
    const revisions = await prisma.wikiRevision.findMany({
      where: status === 'DONE'
        ? { status: { in: ['REVIEWED', 'REWARDED', 'REJECTED'] } }
        : { status: status === 'PENDING' ? 'PENDING' : 'CHANGES_REQUESTED' },
      orderBy: status === 'DONE' ? { reviewedAt: 'desc' } : { updatedAt: 'desc' },
      take: status === 'DONE' ? 100 : undefined,
      include: {
        entry: { select: revisionEntrySelect },
        section: { select: { name: true } },
        // Предложения оптовиков до принятия: их файлы и товары ещё скрыты в вики
        proposalMedia: { orderBy: { createdAt: 'asc' } },
        proposalProducts: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Неодобренное предложение оптовика: разница — текущий текст раздела и он же с дописанным блоком
    const openProposals = revisions.filter(r => r.isExternal && (r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED'));
    const currentText = new Map<string, string>();
    for (const r of openProposals) currentText.set(r.id, await readContent(r.entryId, r.sectionId));

    // Добавленные файлы ещё лежат в вики — берём из БД их сжатые варианты для превью
    const addedIds = revisions.flatMap(r => asMediaRefs(r.addedMedia).map(m => m.id));
    const current = addedIds.length
      ? await prisma.wikiMedia.findMany({ where: { id: { in: addedIds } } })
      : [];
    const currentById = new Map(current.map(m => [m.id, mediaWithUrls(m)]));
    const refWithUrls = (m: MediaRef) => {
      const media = currentById.get(m.id);
      return {
        ...m,
        url: media?.url ?? `${WIKI_MEDIA_URL}/${m.filename}`,
        thumbUrl: media?.thumbUrl ?? null,
        mediumUrl: media?.mediumUrl ?? null,
        placeholder: media?.placeholder ?? null,
        width: media?.width ?? null,
        height: media?.height ?? null,
      };
    };

    return revisions.map(({ section, proposalMedia, proposalProducts, ...r }) => {
      const current = currentText.get(r.id);
      const proposal = current !== undefined
        ? {
          prevContent: current,
          newContent: appendProposalText(current, r.proposalText ?? ''),
          addedMedia: proposalMedia.map(m => {
            const { thumbUrl, mediumUrl, url, placeholder, width, height } = mediaWithUrls(m);
            return { ...toRef(m), url, thumbUrl, mediumUrl, placeholder, width, height };
          }),
          addedProducts: proposalProducts,
        }
        : null;
      return {
        ...r,
        sectionName: section?.name ?? null,
        reviewNotes: asReviewNotes(r.reviewNotes),
        addedMedia: asMediaRefs(r.addedMedia).map(refWithUrls),
        addedProducts: [] as typeof proposalProducts,
        removedMedia: asMediaRefs(r.removedMedia).map(m => ({ ...m, url: `${WIKI_MEDIA_URL}/${m.filename}` })),
        ...proposal,
      };
    });
  },

  async markReviewed(id: string, reviewer: AuthPayload) {
    const revision = await prisma.wikiRevision.findUnique({ where: { id } });
    if (!revision) throw new AppError('Правка не найдена', 404);
    if (revision.isExternal) throw new AppError('Предложение оптовика — примите или отклоните его', 400);
    if (!(OPEN_STATUSES as readonly string[]).includes(revision.status)) throw new AppError('Правка уже проверена', 400);
    await prisma.wikiRevision.update({
      where: { id },
      data: { status: 'REVIEWED', reviewedByName: reviewer.name, reviewedAt: new Date() },
    });
    await this.cleanupRemovedFiles(revision.id);
  },

  /** Вернуть правку автору с замечанием: он дорабатывает раздел и сам отправляет снова */
  async requestChanges(id: string, comment: string, reviewer: AuthPayload) {
    const revision = await prisma.wikiRevision.findUnique({
      where: { id },
      include: { entry: { select: revisionEntrySelect }, section: { select: { name: true } } },
    });
    if (!revision) throw new AppError('Правка не найдена', 404);
    if (revision.status !== 'PENDING') throw new AppError('Вернуть на доработку можно только правку на проверке', 400);
    const notes = [...asReviewNotes(revision.reviewNotes), { text: comment, byName: reviewer.name, at: new Date().toISOString() }];
    const updated = await prisma.wikiRevision.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CHANGES_REQUESTED', reviewNotes: notes as unknown as Prisma.InputJsonValue },
    });
    if (updated.count === 0) throw new AppError('Правку уже проверили', 400);

    // Оптовик vdf.by увидит замечание в личном кабинете магазина — пуша у него нет
    if (revision.isExternal) return;
    const { entry } = revision;
    const car = [entry.markName, entry.modelName, entry.generationName].filter(Boolean).join(' ')
      + (revision.section ? ` · ${revision.section.name}` : '');
    pushInBackground(() => pushService.sendToUsers([revision.authorId], {
      title: 'Wiki: нужна доработка',
      body: `${car}\n${comment}`.slice(0, 200),
      url: wikiUrl(entry, revision.sectionId),
      tag: `wiki-rework-${revision.id}`,
    }));
  },

  /** Автор исправил замечания и отправляет правку на проверку снова */
  resubmit(id: string, user: AuthPayload) {
    return serialized(async () => {
      const revision = await prisma.wikiRevision.findUnique({ where: { id } });
      if (!revision || revision.authorId !== user.id) throw new AppError('Правка не найдена', 404);
      if (revision.status !== 'CHANGES_REQUESTED') throw new AppError('Правка уже отправлена на проверку', 400);
      const isEmpty = revision.prevContent === revision.newContent
        && asMediaRefs(revision.addedMedia).length === 0 && asMediaRefs(revision.removedMedia).length === 0;
      // Автор откатил все свои изменения — проверять нечего
      if (isEmpty) {
        await prisma.wikiRevision.delete({ where: { id } });
        return;
      }
      await prisma.wikiRevision.update({ where: { id }, data: { status: 'PENDING' } });
    });
  },

  /**
   * Назначает премию за правку. amount не передан — полная премия из настроек;
   * передан — проверяющий решил оплатить иначе (обычно частично, если правка неполная).
   */
  async reward(id: string, reviewer: AuthPayload, amount?: number) {
    const revision = await prisma.wikiRevision.findUnique({ where: { id }, include: { entry: true, section: true } });
    if (!revision) throw new AppError('Правка не найдена', 404);
    if (revision.status === 'REWARDED') throw new AppError('Премия за эту правку уже назначена', 400);
    if (revision.isExternal) throw new AppError('Премия за вики — только сотрудникам', 400);

    const settings = await this.getSettings();
    const bonus = amount ?? settings.bonusAmount;
    if (!(bonus > 0)) {
      throw new AppError('Укажите размер премии в настройках вики', 400);
    }
    const isPartial = settings.bonusAmount > 0 && bonus < settings.bonusAmount;
    const author = await prisma.serviceman.findUnique({ where: { id: revision.authorId } });
    if (!author) throw new AppError('Сотрудник, внёсший правку, не найден', 400);

    const { year, month } = currentSalaryMonth();
    const { entry } = revision;
    const car = [entry.markName, entry.modelName, entry.generationName].filter(Boolean).join(' ')
      + (revision.section ? ` · ${revision.section.name}` : '');

    await prisma.$transaction(async tx => {
      const adjustment = await tx.salaryAdjustment.create({
        data: {
          servicemanName: author.name,
          type: 'BONUS',
          amount: bonus,
          reason: `Wiki: ${car}${isPartial ? ' (частичная оплата)' : ''}`,
          year,
          month,
        },
      });
      // Условие по статусу — защита от двойного нажатия: вторая премия за ту же правку не пройдёт
      const updated = await tx.wikiRevision.updateMany({
        where: { id, status: { not: 'REWARDED' } },
        data: {
          status: 'REWARDED',
          reviewedByName: reviewer.name,
          reviewedAt: new Date(),
          bonusAmount: bonus,
          bonusBaseAmount: settings.bonusAmount,
          salaryAdjustmentId: adjustment.id,
        },
      });
      if (updated.count === 0) throw new AppError('Премия за эту правку уже назначена', 400);
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

  // --- Разделы ---

  async listSections() {
    const sections = await prisma.wikiSection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { services: { select: { id: true } } },
    });
    return sections.map(({ services, ...s }) => ({ ...s, serviceIds: services.map(x => x.id) }));
  },

  /** Услуга относится к одному разделу: выбранная здесь уходит из другого раздела */
  async createSection(data: { name: string; serviceIds: string[] }) {
    await prisma.$transaction(async tx => {
      const last = await tx.wikiSection.aggregate({ _max: { sortOrder: true } });
      const section = await tx.wikiSection.create({
        data: { name: data.name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
      await tx.service.updateMany({ where: { id: { in: data.serviceIds } }, data: { wikiSectionId: section.id } });
    });
    return this.listSections();
  },

  async updateSection(id: string, data: { name?: string; serviceIds?: string[] }) {
    await prisma.$transaction(async tx => {
      const section = await tx.wikiSection.findUnique({ where: { id } });
      if (!section) throw new AppError('Раздел вики не найден', 404);
      if (data.name !== undefined) await tx.wikiSection.update({ where: { id }, data: { name: data.name } });
      if (data.serviceIds) {
        await tx.service.updateMany({
          where: { wikiSectionId: id, id: { notIn: data.serviceIds } },
          data: { wikiSectionId: null },
        });
        await tx.service.updateMany({ where: { id: { in: data.serviceIds } }, data: { wikiSectionId: id } });
      }
    });
    return this.listSections();
  },

  /** Раздел, в котором уже что-то описано, не удаляется — иначе пропадут описания */
  async deleteSection(id: string) {
    await prisma.$transaction(async tx => {
      await tx.wikiEntrySection.deleteMany({ where: { sectionId: id, content: '' } });
      const used = await tx.wikiEntrySection.count({ where: { sectionId: id } })
        + await tx.wikiMedia.count({ where: { sectionId: id } })
        + await tx.wikiProduct.count({ where: { sectionId: id } });
      if (used > 0) {
        throw new AppError('В разделе уже есть описания, файлы или товары — удалить его нельзя, только переименовать', 400);
      }
      await tx.wikiSection.delete({ where: { id } });
    });
    return this.listSections();
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
