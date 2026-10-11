import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { MAIL_ATTACHMENTS_DIR } from '../utils/uploads';
import { clip, isViewableType, makePreview, pickNewUids, safeContentType } from '../utils/mail';
import { pushService, pushInBackground } from './push.service';

/**
 * Приём почты из ящика на beget.ru по IMAP (только «Входящие», только чтение).
 *
 * Соединение держится постоянно: сервер почты сам сообщает о новом письме (IDLE), и оно
 * появляется в CRM через несколько секунд. Обрыв — переподключение через минуту; раз в
 * 5 минут контрольная проверка на случай, если уведомление потерялось. Почту видит только создатель.
 * Письма в ящике не помечаются прочитанными и не удаляются: «прочитано» и удаление — только в CRM.
 * Доступ — MAIL_USER / MAIL_PASSWORD в .env; без них приём выключен.
 */

const MAILBOX = 'INBOX';
/** Первый запуск или сменился UIDVALIDITY — забираем письма за последние дни, не весь ящик */
const INITIAL_DAYS = 30;
/** Не больше стольких писем за одну синхронизацию (остальные — в следующую) */
const BATCH_LIMIT = 200;
/** Письма больше этого не скачиваем целиком — в CRM будет заголовок и пометка */
const MAX_MESSAGE_BYTES = 40 * 1024 * 1024;
/** HTML с вшитыми картинками бывает огромным — больше этого показываем только текст */
const MAX_HTML_CHARS = 5 * 1024 * 1024;
const RECONNECT_MS = 60 * 1000;
const CHECK_MS = 5 * 60 * 1000;

let client: ImapFlow | null = null;
let connecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let syncChain: Promise<void> = Promise.resolve();
let lastError: string | null = null;
let lastSyncAt: Date | null = null;

const isConfigured = () => !!(env.mailUser && env.mailPassword);

function scheduleReconnect() {
  client = null;
  if (reconnectTimer || !isConfigured()) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, RECONNECT_MS);
}

async function connect() {
  if (connecting || client) return;
  connecting = true;
  const imap = new ImapFlow({
    host: env.mailImapHost,
    port: env.mailImapPort,
    secure: true,
    auth: { user: env.mailUser, pass: env.mailPassword },
    logger: false,
  });
  imap.on('error', (err: Error) => {
    lastError = err.message;
    logger.warn('Почта: ошибка соединения', { err: err.message });
  });
  imap.on('close', () => {
    if (client === imap) scheduleReconnect();
  });
  // Пришло новое письмо — сервер сообщает об этом, пока соединение простаивает (IDLE)
  imap.on('exists', () => { void requestSync(); });

  try {
    await imap.connect();
    await imap.mailboxOpen(MAILBOX, { readOnly: true });
    client = imap;
    lastError = null;
    logger.info('Почта: подключено', { user: env.mailUser });
    await requestSync();
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logger.warn('Почта: не удалось подключиться', { err: lastError });
    await imap.logout().catch(() => imap.close());
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

/** Синхронизации идут строго по очереди: уведомление о письме может прийти посреди предыдущей */
function requestSync(): Promise<void> {
  syncChain = syncChain.then(() => syncInbox()).catch((err) => {
    lastError = err instanceof Error ? err.message : String(err);
    logger.error('Почта: ошибка синхронизации', { err });
  });
  return syncChain;
}

function firstAddress(from: AddressObject | undefined) {
  const v = from?.value?.[0];
  return { name: clip(v?.name, 300), address: clip(v?.address, 300) };
}

function addressText(to: AddressObject | AddressObject[] | undefined): string | null {
  if (!to) return null;
  return clip((Array.isArray(to) ? to : [to]).map(a => a.text).join(', '), 2000);
}

/** Вложения на диск. Встроенные в HTML картинки mailparser уже вшил в html — их не сохраняем */
async function saveAttachments(parsed: ParsedMail) {
  const saved: { filename: string; originalName: string; contentType: string; size: number }[] = [];
  for (const att of parsed.attachments) {
    if (att.related) continue;
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.bin`;
    await fs.promises.writeFile(path.join(MAIL_ATTACHMENTS_DIR, filename), att.content);
    saved.push({
      filename,
      originalName: clip(att.filename, 300) || 'вложение',
      contentType: clip(att.contentType, 200) || 'application/octet-stream',
      size: att.size ?? att.content.length,
    });
  }
  return saved;
}

/** Одно письмо → база. false — уже было (повторная синхронизация) */
async function storeMessage(imap: ImapFlow, uidValidity: bigint, uid: number, size: number | undefined, fallbackDate: Date) {
  const exists = await prisma.mailMessage.findUnique({
    where: { mailbox_uidValidity_uid: { mailbox: MAILBOX, uidValidity, uid } },
    select: { id: true },
  });
  if (exists) return false;

  if (size && size > MAX_MESSAGE_BYTES) {
    const meta = await imap.fetchOne(String(uid), { envelope: true }, { uid: true });
    const env0 = meta ? meta.envelope : undefined;
    const text = `Письмо больше ${MAX_MESSAGE_BYTES / 1024 / 1024} МБ — откройте его в почте beget.`;
    await prisma.mailMessage.create({
      data: {
        mailbox: MAILBOX, uidValidity, uid,
        messageId: clip(env0?.messageId, 500),
        fromName: clip(env0?.from?.[0]?.name, 300),
        fromAddress: clip(env0?.from?.[0]?.address, 300),
        subject: clip(env0?.subject, 1000),
        date: env0?.date ? new Date(env0.date) : fallbackDate,
        text, preview: text,
      },
    });
    return true;
  }

  const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
  if (!msg || !msg.source) return false;
  const parsed = await simpleParser(msg.source);
  const html = typeof parsed.html === 'string' && parsed.html.length <= MAX_HTML_CHARS ? parsed.html : null;
  const from = firstAddress(parsed.from);
  const attachments = await saveAttachments(parsed);

  try {
    await prisma.mailMessage.create({
      data: {
        mailbox: MAILBOX, uidValidity, uid,
        messageId: clip(parsed.messageId, 500),
        fromName: from.name,
        fromAddress: from.address,
        to: addressText(parsed.to),
        subject: clip(parsed.subject, 1000),
        date: parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : fallbackDate,
        text: parsed.text ?? null,
        html,
        preview: makePreview(parsed.text),
        attachments: { create: attachments },
      },
    });
  } catch (err) {
    // Файлы без строки в базе никому не нужны
    await Promise.all(attachments.map(a => fs.promises.unlink(path.join(MAIL_ATTACHMENTS_DIR, a.filename)).catch(() => undefined)));
    throw err;
  }
  return true;
}

async function syncInbox() {
  const imap = client;
  if (!imap || !imap.usable) return;
  const lock = await imap.getMailboxLock(MAILBOX, { readOnly: true });
  try {
    const box = imap.mailbox;
    if (!box) return;
    const uidValidity = BigInt(box.uidValidity);
    const state = await prisma.mailSyncState.findUnique({ where: { mailbox: MAILBOX } });
    const fresh = !state || state.uidValidity !== uidValidity;

    let candidates: number[];
    if (fresh) {
      const since = new Date(Date.now() - INITIAL_DAYS * 24 * 60 * 60 * 1000);
      candidates = (await imap.search({ since }, { uid: true })) || [];
    } else {
      if (box.uidNext && box.uidNext <= state.lastUid + 1) { lastSyncAt = new Date(); return; }
      candidates = (await imap.search({ uid: `${state.lastUid + 1}:*` }, { uid: true })) || [];
    }
    const lastUid = fresh ? 0 : state.lastUid;
    const uids = pickNewUids(candidates, lastUid, BATCH_LIMIT);
    if (!uids.length) {
      if (fresh) await saveState(uidValidity, Math.max(0, (box.uidNext ?? 1) - 1));
      lastSyncAt = new Date();
      return;
    }

    // Размеры и даты одним запросом, сами письма — по одному (не держим всё в памяти)
    const meta = await imap.fetchAll(uids.join(','), { uid: true, size: true, internalDate: true }, { uid: true });
    const metaByUid = new Map(meta.map(m => [m.uid, m]));
    const added: { fromName: string | null; fromAddress: string | null; subject: string | null }[] = [];
    let maxUid = lastUid;
    for (const uid of uids) {
      const m = metaByUid.get(uid);
      const fallbackDate = m?.internalDate ? new Date(m.internalDate) : new Date();
      if (await storeMessage(imap, uidValidity, uid, m?.size, fallbackDate)) {
        if (!fresh) {
          const row = await prisma.mailMessage.findUnique({
            where: { mailbox_uidValidity_uid: { mailbox: MAILBOX, uidValidity, uid } },
            select: { fromName: true, fromAddress: true, subject: true },
          });
          if (row) added.push(row);
        }
      }
      maxUid = Math.max(maxUid, uid);
      // Прогресс сохраняется после каждого письма: обрыв посередине не приведёт к повторам
      await saveState(uidValidity, maxUid);
    }
    lastSyncAt = new Date();
    if (added.length) notifyNewMail(added);
  } finally {
    lock.release();
  }
}

function saveState(uidValidity: bigint, lastUid: number) {
  return prisma.mailSyncState.upsert({
    where: { mailbox: MAILBOX },
    update: { uidValidity, lastUid },
    create: { mailbox: MAILBOX, uidValidity, lastUid },
  });
}

/** Пуш только сотрудникам с ролью «Создатель». При первом запуске (старые письма) не шлём */
function notifyNewMail(added: { fromName: string | null; fromAddress: string | null; subject: string | null }[]) {
  const first = added[0];
  const body = added.length === 1
    ? `${first.fromName || first.fromAddress || 'Без отправителя'}: ${first.subject || '(без темы)'}`
    : `${added.length} новых писем`;
  pushInBackground(() => pushService.sendToCreators({ title: 'Новое письмо', body, url: '/mail', tag: 'mail' }));
}

/** Папка «Спам», если в ящике нет пометки \Junk (у beget — INBOX.Junk) */
const SPAM_FOLDERS = ['INBOX.Junk', 'INBOX.Spam', 'Junk', 'Spam'];

/**
 * Отдельное короткое соединение для изменений в ящике (перенос в спам). Постоянное соединение
 * открывает «Входящие» только на чтение и ждёт новых писем — его не трогаем.
 */
async function withWritableConnection<T>(fn: (imap: ImapFlow) => Promise<T>): Promise<T> {
  const imap = new ImapFlow({
    host: env.mailImapHost,
    port: env.mailImapPort,
    secure: true,
    auth: { user: env.mailUser, pass: env.mailPassword },
    logger: false,
    disableAutoIdle: true,
  });
  imap.on('error', (err: Error) => logger.warn('Почта: ошибка соединения (изменение ящика)', { err: err.message }));
  try {
    await imap.connect();
  } catch (err) {
    logger.warn('Почта: не удалось подключиться для изменения ящика', { err: err instanceof Error ? err.message : String(err) });
    throw new AppError('Не удалось связаться с почтовым сервером, попробуйте позже', 502);
  }
  try {
    return await fn(imap);
  } finally {
    await imap.logout().catch(() => imap.close());
  }
}

// ─── Чтение из CRM ──────────────────────────────────

const LIST_SELECT = {
  id: true, fromName: true, fromAddress: true, subject: true, date: true, preview: true, isRead: true,
  _count: { select: { attachments: true } },
} as const;

export const mailService = {
  start() {
    if (!isConfigured()) {
      logger.info('Почта выключена: не заданы MAIL_USER / MAIL_PASSWORD');
      return;
    }
    void connect();
    setInterval(() => {
      if (client) void requestSync();
      else if (!connecting && !reconnectTimer) void connect();
    }, CHECK_MS);
  },

  status() {
    return {
      configured: isConfigured(),
      connected: !!client?.usable,
      user: env.mailUser || null,
      lastError,
      lastSyncAt,
    };
  },

  /** «Обновить» в интерфейсе: проверить ящик сейчас */
  async syncNow() {
    if (!isConfigured()) throw new AppError('Почта не настроена', 400);
    if (!client) {
      await connect();
      return;
    }
    await requestSync();
  },

  async list(params: { page: number; pageSize: number; q?: string; unread?: boolean }) {
    const where = {
      ...(params.unread && { isRead: false }),
      ...(params.q && {
        OR: [
          { subject: { contains: params.q, mode: 'insensitive' as const } },
          { fromName: { contains: params.q, mode: 'insensitive' as const } },
          { fromAddress: { contains: params.q, mode: 'insensitive' as const } },
          { text: { contains: params.q, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      prisma.mailMessage.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { date: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.mailMessage.count({ where }),
    ]);
    return {
      items: rows.map(({ _count, ...r }) => ({ ...r, attachmentsCount: _count.attachments })),
      total,
    };
  },

  unreadCount() {
    return prisma.mailMessage.count({ where: { isRead: false } });
  },

  /** Письмо целиком; открытое письмо становится прочитанным */
  async get(id: string) {
    const msg = await prisma.mailMessage.findUnique({
      where: { id },
      select: {
        id: true, fromName: true, fromAddress: true, to: true, subject: true, date: true,
        text: true, html: true, isRead: true,
        attachments: { select: { id: true, originalName: true, contentType: true, size: true }, orderBy: { originalName: 'asc' } },
      },
    });
    if (!msg) throw new AppError('Письмо не найдено', 404);
    if (!msg.isRead) await prisma.mailMessage.update({ where: { id }, data: { isRead: true } });
    return {
      ...msg,
      isRead: true,
      attachments: msg.attachments.map(a => ({ ...a, viewable: isViewableType(a.contentType) })),
    };
  },

  async setRead(id: string, isRead: boolean) {
    await prisma.mailMessage.update({ where: { id }, data: { isRead } });
  },

  async markAllRead() {
    await prisma.mailMessage.updateMany({ where: { isRead: false }, data: { isRead: true } });
  },

  /** Только из CRM: в ящике письмо остаётся, повторно не скачивается (UID уже пройден) */
  async delete(id: string) {
    const attachments = await prisma.mailAttachment.findMany({ where: { messageId: id }, select: { filename: true } });
    await prisma.mailMessage.delete({ where: { id } });
    await Promise.all(attachments.map(a => fs.promises.unlink(path.join(MAIL_ATTACHMENTS_DIR, a.filename)).catch(() => undefined)));
  },

  /**
   * «В спам»: письмо переносится в папку «Спам» в ящике beget и удаляется из CRM.
   * Если в ящике его уже нет (удалили с телефона) — просто убираем из CRM.
   */
  async moveToSpam(id: string) {
    if (!isConfigured()) throw new AppError('Почта не настроена', 400);
    const msg = await prisma.mailMessage.findUnique({ where: { id }, select: { mailbox: true, uidValidity: true, uid: true } });
    if (!msg) throw new AppError('Письмо не найдено', 404);

    await withWritableConnection(async (imap) => {
      const boxes = await imap.list();
      const spam = boxes.find(b => b.specialUse === '\\Junk') ?? boxes.find(b => SPAM_FOLDERS.includes(b.path));
      if (!spam) throw new AppError('В почтовом ящике нет папки «Спам»', 400);
      const lock = await imap.getMailboxLock(msg.mailbox);
      try {
        // Папку пересоздали — UID писем в ней другие, переносить по старому UID нельзя
        if (imap.mailbox && BigInt(imap.mailbox.uidValidity) !== msg.uidValidity) {
          throw new AppError('Папка в ящике изменилась, обновите почту и попробуйте снова', 409);
        }
        await imap.messageMove(String(msg.uid), spam.path, { uid: true });
      } finally {
        lock.release();
      }
    });
    await mailService.delete(id);
  },

  async attachment(id: string) {
    const att = await prisma.mailAttachment.findUnique({ where: { id } });
    if (!att) throw new AppError('Вложение не найдено', 404);
    return {
      path: path.join(MAIL_ATTACHMENTS_DIR, att.filename),
      originalName: att.originalName,
      contentType: safeContentType(att.contentType),
    };
  },
};
