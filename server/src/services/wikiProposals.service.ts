import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AuthPayload } from '../middleware/auth.middleware';
import {
  assertSection, asReviewNotes, getOrCreateEntry, mediaWithUrls, readContent, removeFile, serialized, toRef,
  wikiService, SectionId, UploadedFile, WikiKey,
} from './wiki.service';
import { vdfCatalogService } from './vdfCatalog.service';
import { appendProposalText } from './wikiProposals.logic';
import { pushService, pushInBackground } from './push.service';
import { ROLES } from '../utils/roles';

/**
 * Предложения оптовиков vdf.by в вики. Оптовик дописывает свой блок текста в раздел карточки,
 * прикладывает фото, видео и товары и отправляет на проверку. В карточку ничего не попадает,
 * пока проверяющий не нажмёт «Принять»: текст дописывается в конец раздела, файлы и товары
 * становятся видны. Можно вернуть на доработку с замечанием или отклонить.
 * Магазин ходит сюда по общему ключу (routes/integrations.routes.ts) и передаёт покупателя.
 */

export interface VdfAuthor {
  customerId: number;
  name: string;
  phone?: string;
}

const AUTHOR_ROLE = 'Оптовик vdf.by';

const authorIdOf = (customerId: number) => `vdf:${customerId}`;

/** Пока оптовик пишет или дорабатывает — предложение можно менять; на проверке — нет */
const EDITABLE = ['DRAFT', 'CHANGES_REQUESTED'] as const;
const OPEN = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED'] as const;

const proposalInclude = {
  entry: { select: { markId: true, modelId: true, generationId: true, markName: true, modelName: true, generationName: true } },
  section: { select: { name: true } },
  proposalMedia: { orderBy: { createdAt: 'asc' } },
  proposalProducts: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.WikiRevisionInclude;

// Денежные поля расширение клиента отдаёт числами — здесь они не нужны
type ProposalRow = Omit<Prisma.WikiRevisionGetPayload<{ include: typeof proposalInclude }>, 'bonusAmount' | 'bonusBaseAmount'>;

function toProposal(r: ProposalRow) {
  return {
    id: r.id,
    status: r.status,
    sectionId: r.sectionId,
    sectionName: r.section?.name ?? null,
    text: r.proposalText ?? '',
    reviewNotes: asReviewNotes(r.reviewNotes),
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    entry: r.entry,
    media: r.proposalMedia.map(mediaWithUrls),
    products: r.proposalProducts,
  };
}

async function openProposal(entryId: string, sectionId: SectionId, author: VdfAuthor) {
  return prisma.wikiRevision.findFirst({
    where: { entryId, sectionId, authorId: authorIdOf(author.customerId), isExternal: true, status: { in: [...OPEN] } },
  });
}

/** Открытое предложение оптовика по разделу; нет — заводим черновик. На проверке менять нельзя */
async function editableProposal(key: WikiKey, sectionId: SectionId, author: VdfAuthor) {
  await assertSection(sectionId);
  const entry = await getOrCreateEntry(key);
  const existing = await openProposal(entry.id, sectionId, author);
  if (existing) {
    if (!(EDITABLE as readonly string[]).includes(existing.status)) {
      throw new AppError('Информация уже на проверке — дождитесь ответа', 400);
    }
    return existing;
  }
  return prisma.wikiRevision.create({
    data: {
      entryId: entry.id,
      sectionId,
      authorId: authorIdOf(author.customerId),
      authorName: author.name,
      authorRole: AUTHOR_ROLE,
      authorPhone: author.phone ?? null,
      isExternal: true,
      status: 'DRAFT',
      proposalText: '',
      prevContent: '',
      newContent: '',
    },
  });
}

async function ownProposal(id: string, author: VdfAuthor) {
  const revision = await prisma.wikiRevision.findUnique({ where: { id } });
  if (!revision || !revision.isExternal || revision.authorId !== authorIdOf(author.customerId)) {
    throw new AppError('Не найдено', 404);
  }
  return revision;
}

async function loadProposal(id: string) {
  return toProposal(await prisma.wikiRevision.findUniqueOrThrow({ where: { id }, include: proposalInclude }));
}

/** Удаляет файлы предложения с диска и строки файлов и товаров */
async function dropProposalFiles(revisionId: string) {
  const media = await prisma.wikiMedia.findMany({ where: { revisionId }, select: { filename: true } });
  await prisma.$transaction([
    prisma.wikiMedia.deleteMany({ where: { revisionId } }),
    prisma.wikiProduct.deleteMany({ where: { revisionId } }),
  ]);
  for (const m of media) removeFile(m.filename);
}

export const wikiProposalsService = {
  // --- Сторона оптовика (через магазин) ---

  /** Карточка как её видят все (без чужих неодобренных предложений) + свои предложения по ней */
  async entryFor(key: WikiKey, author: VdfAuthor) {
    const entry = await wikiService.getEntry(key);
    const proposals = entry
      ? await prisma.wikiRevision.findMany({
        where: { entryId: entry.id, authorId: authorIdOf(author.customerId), isExternal: true, status: { in: [...OPEN] } },
        include: proposalInclude,
        orderBy: { createdAt: 'asc' },
      })
      : [];
    return { entry, proposals: proposals.map(toProposal) };
  },

  /** Все предложения оптовика: что в работе, что вернули, что приняли (последние 100) */
  async listFor(author: VdfAuthor) {
    const rows = await prisma.wikiRevision.findMany({
      where: { authorId: authorIdOf(author.customerId), isExternal: true },
      include: proposalInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map(toProposal);
  },

  saveText(key: WikiKey, sectionId: SectionId, text: string, author: VdfAuthor) {
    return serialized(async () => {
      const proposal = await editableProposal(key, sectionId, author);
      await prisma.wikiRevision.update({
        where: { id: proposal.id },
        data: { proposalText: text.replace(/\r\n/g, '\n'), authorName: author.name, authorPhone: author.phone ?? null },
      });
      return loadProposal(proposal.id);
    });
  },

  addMedia(key: WikiKey, sectionId: SectionId, file: UploadedFile, author: VdfAuthor) {
    return serialized(async () => {
      let proposal;
      try {
        proposal = await editableProposal(key, sectionId, author);
      } catch (e) {
        removeFile(file.filename);
        throw e;
      }
      const { variants, ...fileData } = file;
      const media = await prisma.wikiMedia.create({
        data: { entryId: proposal.entryId, sectionId, ...fileData, ...variants, uploadedByName: author.name, revisionId: proposal.id },
      });
      await prisma.wikiRevision.update({ where: { id: proposal.id }, data: { updatedAt: new Date() } });
      return mediaWithUrls(media);
    });
  },

  /** Оптовик удаляет только свои ещё не принятые файлы */
  removeMedia(mediaId: string, author: VdfAuthor) {
    return serialized(async () => {
      const media = await prisma.wikiMedia.findUnique({ where: { id: mediaId } });
      if (!media?.revisionId) throw new AppError('Файл не найден', 404);
      const proposal = await ownProposal(media.revisionId, author);
      if (!(EDITABLE as readonly string[]).includes(proposal.status)) {
        throw new AppError('Информация уже на проверке — дождитесь ответа', 400);
      }
      await prisma.wikiMedia.delete({ where: { id: mediaId } });
      removeFile(media.filename);
    });
  },

  /** Название, ссылку и картинку берём у магазина по id — как у сотрудников */
  addProduct(key: WikiKey, sectionId: SectionId, productId: string, author: VdfAuthor) {
    return serialized(async () => {
      const product = await vdfCatalogService.byId(productId);
      if (!product) throw new AppError('Товар не найден в каталоге vdf.by', 404);
      const proposal = await editableProposal(key, sectionId, author);
      const existing = await prisma.wikiProduct.findFirst({ where: { revisionId: proposal.id, productId } });
      if (!existing) {
        await prisma.wikiProduct.create({
          data: {
            entryId: proposal.entryId,
            sectionId,
            productId,
            title: product.title,
            url: product.url,
            imageUrl: product.image,
            addedByName: author.name,
            revisionId: proposal.id,
          },
        });
      }
      return loadProposal(proposal.id);
    });
  },

  removeProduct(productRowId: string, author: VdfAuthor) {
    return serialized(async () => {
      const product = await prisma.wikiProduct.findUnique({ where: { id: productRowId } });
      if (!product?.revisionId) throw new AppError('Товар не найден', 404);
      const proposal = await ownProposal(product.revisionId, author);
      if (!(EDITABLE as readonly string[]).includes(proposal.status)) {
        throw new AppError('Информация уже на проверке — дождитесь ответа', 400);
      }
      await prisma.wikiProduct.delete({ where: { id: productRowId } });
    });
  },

  /** Отправить на проверку — и в первый раз, и после доработки */
  submit(id: string, author: VdfAuthor) {
    return serialized(async () => {
      const proposal = await ownProposal(id, author);
      if (!(EDITABLE as readonly string[]).includes(proposal.status)) throw new AppError('Уже на проверке', 400);
      const [media, products] = await Promise.all([
        prisma.wikiMedia.count({ where: { revisionId: id } }),
        prisma.wikiProduct.count({ where: { revisionId: id } }),
      ]);
      if (!proposal.proposalText?.trim() && media === 0 && products === 0) {
        throw new AppError('Напишите текст или добавьте фото, видео или товары', 400);
      }
      await prisma.wikiRevision.update({ where: { id }, data: { status: 'PENDING' } });
      const result = await loadProposal(id);
      // Проверяющие вики — менеджеры и выше (REVIEWER_ROLES в wiki.service)
      const car = [result.entry.markName, result.entry.modelName, result.entry.generationName].filter(Boolean).join(' ');
      pushInBackground(() => pushService.sendToRole(ROLES.MANAGER, {
        title: proposal.status === 'CHANGES_REQUESTED' ? 'Wiki: оптовик доработал информацию' : 'Wiki: информация от оптовика',
        body: `${author.name} · ${car}${result.sectionName ? ` · ${result.sectionName}` : ''}`,
        url: '/wiki?tab=review',
        tag: `wiki-proposal-${id}`,
      }));
      return result;
    });
  },

  /** Удалить черновик или возвращённое предложение целиком */
  discard(id: string, author: VdfAuthor) {
    return serialized(async () => {
      const proposal = await ownProposal(id, author);
      if (!(EDITABLE as readonly string[]).includes(proposal.status)) {
        throw new AppError('Информация уже на проверке — дождитесь ответа', 400);
      }
      await dropProposalFiles(id);
      await prisma.wikiRevision.delete({ where: { id } });
    });
  },

  // --- Сторона проверяющего (CRM) ---

  /**
   * Принять: блок текста дописывается в конец раздела, файлы и товары становятся видны.
   * Для истории правка запоминает текст раздела до и после — как у правок сотрудников.
   */
  accept(id: string, reviewer: AuthPayload) {
    return serialized(async () => {
      const revision = await prisma.wikiRevision.findUnique({ where: { id } });
      if (!revision?.isExternal) throw new AppError('Предложение не найдено', 404);
      if (revision.status !== 'PENDING' && revision.status !== 'CHANGES_REQUESTED') {
        throw new AppError('Предложение уже рассмотрено', 400);
      }
      const { entryId, sectionId } = revision;
      const prev = await readContent(entryId, sectionId);
      const next = appendProposalText(prev, revision.proposalText ?? '');
      const media = await prisma.wikiMedia.findMany({ where: { revisionId: id } });

      await prisma.$transaction(async tx => {
        if (next !== prev) {
          if (sectionId) {
            await tx.wikiEntrySection.upsert({
              where: { entryId_sectionId: { entryId, sectionId } },
              create: { entryId, sectionId, content: next, updatedByName: revision.authorName },
              update: { content: next, updatedByName: revision.authorName },
            });
          }
          await tx.wikiEntry.update({
            where: { id: entryId },
            data: { ...(sectionId ? {} : { content: next }), updatedByName: revision.authorName },
          });
        } else {
          await tx.wikiEntry.update({ where: { id: entryId }, data: { updatedByName: revision.authorName } });
        }
        await tx.wikiMedia.updateMany({ where: { revisionId: id }, data: { revisionId: null } });
        // Такой товар уже есть в разделе — второй раз не добавляем
        const proposed = await tx.wikiProduct.findMany({ where: { revisionId: id } });
        for (const p of proposed) {
          const duplicate = await tx.wikiProduct.findFirst({
            where: { entryId, sectionId, productId: p.productId, revisionId: null },
          });
          if (duplicate) await tx.wikiProduct.delete({ where: { id: p.id } });
          else await tx.wikiProduct.update({ where: { id: p.id }, data: { revisionId: null } });
        }
        const updated = await tx.wikiRevision.updateMany({
          where: { id, status: revision.status },
          data: {
            status: 'REVIEWED',
            prevContent: prev,
            newContent: next,
            addedMedia: media.map(toRef) as unknown as Prisma.InputJsonValue,
            reviewedByName: reviewer.name,
            reviewedAt: new Date(),
          },
        });
        if (updated.count === 0) throw new AppError('Предложение уже рассмотрено', 400);
      });
    });
  },

  /** Отклонить: файлы и товары удаляются, в истории остаётся текст предложения */
  reject(id: string, reviewer: AuthPayload) {
    return serialized(async () => {
      const revision = await prisma.wikiRevision.findUnique({ where: { id } });
      if (!revision?.isExternal) throw new AppError('Предложение не найдено', 404);
      if (revision.status !== 'PENDING' && revision.status !== 'CHANGES_REQUESTED') {
        throw new AppError('Предложение уже рассмотрено', 400);
      }
      await dropProposalFiles(id);
      await prisma.wikiRevision.update({
        where: { id },
        data: { status: 'REJECTED', reviewedByName: reviewer.name, reviewedAt: new Date() },
      });
    });
  },
};
