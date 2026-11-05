import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { prisma, DbClient } from '../prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { RECORD_MEDIA_DIR, SITE_LEAD_MEDIA_DIR, UPLOADS_DIR, WIKI_MEDIA_DIR } from '../utils/uploads';
import { createPanicEncryptStream, parseHexKey, verifyPanicPin } from '../utils/panicCrypto';
import { PanicPinGuard } from '../utils/panicPinGuard';
import { revokeAllSessions } from '../utils/sessionRevocation';
import { enableLiteMode, markLiteModeOn } from '../utils/liteMode';
import { startOfDay } from '../utils/date';
import { isRecordRetained, LITE_MODE_ROLES } from './liteMode.logic';

/**
 * Тревожная кнопка («Протокол AID» в настройках).
 * Верный PIN → вся база и все файлы шифруются открытым ключом владельца в data/panic,
 * затем CRM переходит в облегчённый режим (utils/liteMode.ts) и остаётся рабочей:
 *  - клиентская база, сотрудники (кроме Создателя, Директора и Менеджера), наличная касса,
 *    капитал, ЗП, VDF, аналитика, вики, заявки, заметки, категории расходов и источники
 *    клиентов удаляются;
 *  - в расписании остаются активные записи с сегодняшнего дня и закрытые без наличных
 *    (РС, карта, юрлица) — с их клиентами, машинами, фото и приходами, всё по РС;
 *  - почта, долги, справочники, склад (без закупочных цен), настройки и шаблоны остаются.
 * Потом удаляются все бэкапы, все устройства разлогиниваются.
 * Восстановление — приватным ключом владельца, см. .deploy/README-panic.md.
 *
 * Если зашифровать базу не удалось, ничего не удаляется: данные без копии не вернуть.
 */

/**
 * Таблицы, которые очищаются целиком. TRUNCATE без CASCADE: если в схеме появится таблица со
 * ссылкой на одну из этих и её забудут добавить сюда, очистка упадёт, а не удалит лишнее молча.
 * Таблицы, из которых часть строк остаётся (записи, клиенты, касса, сотрудники), чистит wipeForLiteMode.
 */
export const PANIC_WIPE_TABLES = [
  // Записи и зарплата по ним
  'DealSalaryTransfer', 'SmsLog',
  // Деньги
  'FounderSalary', 'EmployeeSalaryPayment', 'SalaryAdjustment', 'SalaryRate',
  'MonthlyRevenue', 'MonthlyRecordCount', 'VdfOrderPayment', 'VdfOrder',
  // Журнал изменений денег, заметки, подписки устройств
  'AuditLog', 'Note', 'PushSubscription',
  // Заявки с сайта (имя, телефон; фото — в uploads). Новые принимаются как обычно
  'SiteLead',
  // Вики (файлы — в uploads)
  'WikiRevision', 'WikiProduct', 'WikiMedia', 'WikiEntrySection', 'WikiEntry', 'WikiSettings',
] as const;

/** Таблицы с удалёнными строками: VACUUM FULL физически убирает старые версии строк с диска */
const VACUUM_TABLES = [
  'Record', 'RecordItem', 'RecordMedia', 'Deal', 'DealEquipment', 'CashTransaction', 'CapitalTransaction',
  'Client', 'Car', 'Serviceman', 'ExpenseCategory', 'ClientSource', 'WikiSection', 'StockItem', 'DebtPayment',
];

/** Файлы, которые удаляются после того, как uploads зашифрован */
interface FilesToRemove {
  recordMedia: string[];
  siteLeadPhotos: string[];
}

/**
 * Очистка под облегчённый режим. Вызывается внутри транзакции; флаг режима ставится в ней же.
 * Сырые запросы: расширение журнала (prisma/audit.ts) не пишет удаляемое в AuditLog
 */
export async function wipeForLiteMode(tx: DbClient, now: Date): Promise<FilesToRemove> {
  const records = await tx.record.findMany({
    select: {
      id: true, scheduledAt: true, status: true, importKey: true, isLegalEntity: true,
      deal: { select: { isPaidByBankTransfer: true, splitCashAmount: true, currencyPayments: true } },
    },
  });
  const incomes = await tx.cashTransaction.findMany({
    where: { recordId: { not: null }, type: { in: ['INCOME', 'INCOME_RS'] } },
    select: { recordId: true, type: true },
  });
  const incomeTypes = new Map<string, string[]>();
  for (const t of incomes) incomeTypes.set(t.recordId!, [...(incomeTypes.get(t.recordId!) ?? []), t.type]);
  const todayStart = startOfDay(now);
  const keep = records
    .filter(r => isRecordRetained({ ...r, incomeTypes: incomeTypes.get(r.id) ?? [] }, todayStart))
    .map(r => r.id);

  const media = await tx.recordMedia.findMany({
    where: { recordId: { notIn: keep } },
    select: { filename: true, thumbFilename: true },
  });
  const leads = await tx.siteLead.findMany({ select: { photos: true } });
  const staff = await tx.serviceman.findMany({ select: { id: true, name: true, role: true, isDismissed: true } });
  const removedStaff = staff.filter(s => s.isDismissed || !LITE_MODE_ROLES.includes(s.role ?? ''));
  const removedIds = removedStaff.map(s => s.id);
  const removedNames = removedStaff.map(s => s.name);

  const tables = PANIC_WIPE_TABLES.map(t => `"${t}"`).join(', ');
  await tx.$executeRawUnsafe(`TRUNCATE ${tables}`);

  // Касса: остаются только приходы оставленных записей, и все они — по РС
  await tx.$executeRaw`DELETE FROM "CashTransaction"
    WHERE "recordId" IS NULL OR NOT ("recordId" = ANY(${keep}::text[])) OR "type" NOT IN ('INCOME', 'INCOME_RS')`;
  await tx.$executeRaw`UPDATE "CashTransaction"
    SET "type" = 'INCOME_RS', "currency" = NULL, "currencyAmount" = NULL, "currencyRate" = NULL WHERE "type" = 'INCOME'`;
  // Капитал (погашения долгов теряют ссылку на операцию, сами долги остаются)
  await tx.$executeRaw`DELETE FROM "CapitalTransaction"`;

  // Записи, сделки и позиции
  await tx.$executeRaw`DELETE FROM "Deal" WHERE NOT ("recordId" = ANY(${keep}::text[]))`;
  await tx.$executeRaw`UPDATE "Deal"
    SET "isPaidByBankTransfer" = true, "splitCashAmount" = NULL, "splitCardAmount" = NULL, "currencyPayments" = NULL`;
  await tx.$executeRaw`DELETE FROM "Record" WHERE NOT ("id" = ANY(${keep}::text[]))`;
  await tx.$executeRaw`UPDATE "RecordItem"
    SET "prepaidByCard" = true, "prepaidCurrency" = NULL, "prepaidCurrencyAmount" = NULL, "prepaidRate" = NULL, "servicemanSplit" = NULL`;

  // Сотрудники: остаются только те, кто входит в облегчённом режиме, и не как исполнители
  await tx.$executeRaw`UPDATE "Record" SET "serviceman" = NULL WHERE "serviceman" = ANY(${removedNames}::text[])`;
  await tx.$executeRaw`UPDATE "Record" SET "receptionist" = NULL WHERE "receptionist" = ANY(${removedNames}::text[])`;
  await tx.$executeRaw`UPDATE "RecordItem" SET "servicemanName" = NULL WHERE "servicemanName" = ANY(${removedNames}::text[])`;
  await tx.$executeRaw`DELETE FROM "Serviceman" WHERE "id" = ANY(${removedIds}::text[])`;
  await tx.$executeRaw`UPDATE "Serviceman" SET "isPerformer" = false, "isReceptionist" = false, "isDefault" = false`;

  // Клиенты и машины — только те, что в оставленных записях
  await tx.$executeRaw`DELETE FROM "Car" WHERE "id" NOT IN (SELECT "carId" FROM "Record")`;
  await tx.$executeRaw`DELETE FROM "Client" WHERE "id" NOT IN (SELECT "clientId" FROM "Record")`;

  // Справочники скрытых разделов (ссылки на них обнуляются внешними ключами)
  await tx.$executeRaw`DELETE FROM "ExpenseCategory"`;
  await tx.$executeRaw`DELETE FROM "ClientSource"`;
  await tx.$executeRaw`DELETE FROM "WikiSection"`;
  await tx.$executeRaw`UPDATE "StockItem" SET "purchasePrice" = NULL`;

  await enableLiteMode(tx);

  return {
    recordMedia: media.flatMap(m => (m.thumbFilename ? [m.filename, m.thumbFilename] : [m.filename])),
    siteLeadPhotos: leads.flatMap(l => l.photos),
  };
}

const guard = new PanicPinGuard();
let running = false;

function panicRoot() {
  return env.panicDir || path.resolve(UPLOADS_DIR, '..', 'panic');
}

/** pg_dump не понимает параметры Prisma в строке подключения (?schema=…) */
function pgDumpUrl() {
  const url = new URL(process.env.DATABASE_URL!);
  url.search = '';
  return url.toString();
}

/** Вывод команды → (gzip) → шифрование → файл. Ошибка, если команда завершилась не с 0. */
export async function encryptCommandOutput(cmd: string, args: string[], outPath: string, gzip: boolean) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-2000); });
  const exited = new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve(code ?? -1));
  });
  const tmp = `${outPath}.tmp`;
  const encrypt = createPanicEncryptStream(env.panicPublicKey);
  const out = fs.createWriteStream(tmp);
  await Promise.all([
    gzip ? pipeline(child.stdout, zlib.createGzip(), encrypt, out) : pipeline(child.stdout, encrypt, out),
    exited.then((code) => {
      if (code !== 0) throw new Error(`${cmd} завершился с кодом ${code}: ${stderr.trim()}`);
    }),
  ]).catch(async (e) => {
    await fs.promises.rm(tmp, { force: true });
    throw e;
  });
  await fs.promises.rename(tmp, outPath);
}

/** Удалить всё содержимое папки, саму папку оставить */
async function emptyDir(dir: string) {
  const entries = await fs.promises.readdir(dir).catch(() => [] as string[]);
  await Promise.all(entries.map(name => fs.promises.rm(path.join(dir, name), { recursive: true, force: true })));
}

function isConfigured(): boolean {
  if (!env.panicPinHash) return false;
  try {
    parseHexKey(env.panicPublicKey, 'PANIC_PUBLIC_KEY');
    return true;
  } catch {
    return false;
  }
}

/** Удалить файлы из папки по именам (имена из базы — только базовое имя, без путей) */
async function removeFiles(dir: string, names: string[]) {
  await Promise.all(names.map(name => fs.promises.rm(path.join(dir, path.basename(name)), { force: true })));
}

/** Файлы шифруются уже после ответа пользователю: фото и видео может быть много */
async function encryptUploadsAndCleanup(dir: string, files: FilesToRemove) {
  try {
    await encryptCommandOutput('tar', ['-czf', '-', '-C', UPLOADS_DIR, '.'], path.join(dir, 'uploads.tar.gz.enc'), false);
    await removeFiles(RECORD_MEDIA_DIR, files.recordMedia);
    await removeFiles(SITE_LEAD_MEDIA_DIR, files.siteLeadPhotos);
    await emptyDir(WIKI_MEDIA_DIR);
    logger.warn('panic: файлы зашифрованы, фото удалённых записей, заявок и файлы вики удалены');
  } catch (err) {
    // Файлы остаются на месте — повторное нажатие кнопки попробует снова
    logger.error('panic: не удалось зашифровать файлы, они не удалены', { err });
  } finally {
    running = false;
  }
}

/**
 * Передать протокол в магазин vdf.by: тот же общий ключ и тот же PIN, свой код VDF
 * зашифрует и очистит свою базу. Делается только после успешного срабатывания здесь,
 * поэтому PIN заведомо верный. Лучшее усилие: сбой не отменяет уже сделанное.
 */
async function propagateToVdf(pin: string) {
  if (!env.vdfUrl || !env.vdfIntegrationKey) return;
  try {
    const res = await fetch(`${env.vdfUrl}/api/integrations/panic/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-integration-key': env.vdfIntegrationKey },
      body: JSON.stringify({ pin }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) logger.warn('panic: протокол передан в VDF');
    else logger.error(`panic: VDF ответил ${res.status} на передачу протокола`);
  } catch (err) {
    logger.error('panic: не удалось передать протокол в VDF', { err });
  }
}

/** Шаги перехода, по которым растёт прогрессбар на экране запуска протокола */
export interface PanicProgress {
  /** Выполнено шагов из total (0..total) */
  done: number;
  total: number;
  /** Подпись текущего шага */
  label: string;
}

// Шифрование базы, очистка, затем VACUUM каждой таблицы, и завершение (сессии, бэкапы)
const PROGRESS_TOTAL = 2 + VACUUM_TABLES.length + 1;

export const panicService = {
  /**
   * true — данные зашифрованы и удалены. false — неверный PIN, блокировка, кнопка не настроена
   * или ошибка; снаружи эти случаи неотличимы.
   *
   * propagate — передать протокол в VDF (при нажатии в CRM). При вызове из самого VDF
   * стоит false, иначе два сервиса дёргали бы друг друга по кругу.
   * onProgress — шаги перехода для прогрессбара (только при верном PIN). Шифрование файлов идёт
   * в фоне уже после последнего шага, прогрессбар его не ждёт.
   */
  async trigger(
    pin: string,
    user: { name: string },
    opts: { propagate?: boolean; onProgress?: (p: PanicProgress) => void } = {},
  ): Promise<boolean> {
    let doneSteps = 0;
    const progress = (label: string) => opts.onProgress?.({ done: doneSteps, total: PROGRESS_TOTAL, label });
    const tick = (label: string) => { doneSteps += 1; progress(label); };
    if (!isConfigured()) {
      logger.error('panic: кнопка не настроена (PANIC_PUBLIC_KEY / PANIC_PIN_HASH)', { by: user.name });
      return false;
    }
    if (guard.isLocked()) {
      logger.warn('panic: попытка во время блокировки', { by: user.name });
      return false;
    }
    if (!verifyPanicPin(pin, env.panicPinHash)) {
      guard.fail();
      logger.warn('panic: неверный PIN', { by: user.name });
      return false;
    }
    guard.success();
    if (running) return true;
    running = true;

    const dir = path.join(panicRoot(), new Date().toISOString().replace(/[:.]/g, '-'));
    logger.warn('panic: запущено', { by: user.name, dir });

    // 1. Вся база — в зашифрованный архив. Не получилось — ничего не трогаем
    progress('Шифрование базы');
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await encryptCommandOutput('pg_dump', ['--no-owner', `--dbname=${pgDumpUrl()}`], path.join(dir, 'database.sql.gz.enc'), true);
      tick('База зашифрована');
    } catch (err) {
      running = false;
      logger.error('panic: не удалось зашифровать базу, данные не удалены', { err });
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      return false;
    }

    // 2. Очистка одной транзакцией. Архив с этого момента не удаляется ни при какой ошибке
    let files: FilesToRemove;
    try {
      files = await prisma.$transaction(tx => wipeForLiteMode(tx, new Date()), { timeout: 120_000 });
      markLiteModeOn();
      tick('Данные очищены');
    } catch (err) {
      running = false;
      logger.error('panic: не удалось очистить базу', { err });
      return false;
    }

    // Дальше — по возможности: сбой одного шага не отменяет остальные
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try { await fn(); } catch (err) { logger.error(`panic: ${name}`, { err }); }
    };
    // Старые версии удалённых строк физически убираются с диска
    for (const table of VACUUM_TABLES) {
      await step(`VACUUM ${table}`, () => prisma.$executeRawUnsafe(`VACUUM FULL "${table}"`));
      tick('Затирание следов на диске');
    }
    await step('CHECKPOINT', () => prisma.$executeRawUnsafe('CHECKPOINT'));
    // 3. Все устройства — на экран входа (при выходе клиент чистит кеш данных)
    await step('отзыв сессий', () => revokeAllSessions());
    // 4. Бэкапы хоста
    if (env.backupsDir) await step('удаление бэкапов', () => emptyDir(env.backupsDir));
    // 5. Тот же протокол в магазине vdf.by
    if (opts.propagate) await step('передача протокола в VDF', () => propagateToVdf(pin));
    tick('Завершение');
    logger.warn('panic: база зашифрована и очищена, включён облегчённый режим');

    void encryptUploadsAndCleanup(dir, files);
    return true;
  },
};
