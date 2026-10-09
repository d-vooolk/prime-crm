import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { RECORD_MEDIA_DIR, UPLOADS_DIR } from '../utils/uploads';
import { createPanicEncryptStream, parseHexKey, verifyPanicPin } from '../utils/panicCrypto';
import { PanicPinGuard } from '../utils/panicPinGuard';
import { revokeAllSessions } from '../utils/sessionRevocation';
import type { AuthPayload } from '../middleware/auth.middleware';

/**
 * Тревожная кнопка («Протокол AID» в настройках).
 * Верный PIN → вся база и все файлы шифруются открытым ключом владельца в data/panic,
 * затем из базы удаляются клиенты, записи и всё денежное, фото записей и все бэкапы,
 * все устройства разлогиниваются. Справочники, сотрудники, настройки, вики и склад остаются.
 * Восстановление — приватным ключом владельца, см. .deploy/README-panic.md.
 *
 * Если зашифровать базу не удалось, ничего не удаляется: данные без копии не вернуть.
 */

/**
 * Что очищается. TRUNCATE без CASCADE: если в схеме появится таблица со ссылкой на одну
 * из этих и её забудут добавить сюда, очистка упадёт, а не удалит лишнее молча.
 */
export const PANIC_WIPE_TABLES = [
  // Клиенты и записи
  'Client', 'Car', 'Record', 'RecordItem', 'RecordMedia', 'Deal', 'DealEquipment', 'SmsLog',
  // Деньги
  'CashTransaction', 'CapitalTransaction', 'Debt', 'DebtPayment',
  'FounderSalary', 'EmployeeSalaryPayment', 'SalaryAdjustment', 'SalaryRate',
  'MonthlyRevenue', 'MonthlyRecordCount', 'VdfOrder', 'VdfOrderPayment',
  // Журнал изменений денег, личные заметки, подписки устройств
  'AuditLog', 'Note', 'PushSubscription',
] as const;

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

/** Файлы шифруются уже после ответа пользователю: фото и видео может быть много */
async function encryptUploadsAndCleanup(dir: string) {
  try {
    await encryptCommandOutput('tar', ['-czf', '-', '-C', UPLOADS_DIR, '.'], path.join(dir, 'uploads.tar.gz.enc'), false);
    await emptyDir(RECORD_MEDIA_DIR);
    logger.warn('panic: файлы зашифрованы, фото записей удалены');
  } catch (err) {
    // Фото записей остаются на месте — повторное нажатие кнопки попробует снова
    logger.error('panic: не удалось зашифровать файлы, фото записей не удалены', { err });
  } finally {
    running = false;
  }
}

export const panicService = {
  /**
   * true — данные зашифрованы и удалены. false — неверный PIN, блокировка, кнопка не настроена
   * или ошибка; снаружи эти случаи неотличимы.
   */
  async trigger(pin: string, user: AuthPayload): Promise<boolean> {
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
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await encryptCommandOutput('pg_dump', ['--no-owner', `--dbname=${pgDumpUrl()}`], path.join(dir, 'database.sql.gz.enc'), true);
    } catch (err) {
      running = false;
      logger.error('panic: не удалось зашифровать базу, данные не удалены', { err });
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      return false;
    }

    // 2. Очистка одной транзакцией. Архив с этого момента не удаляется ни при какой ошибке
    try {
      const tables = PANIC_WIPE_TABLES.map(t => `"${t}"`).join(', ');
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`TRUNCATE ${tables}`);
        await tx.$executeRawUnsafe(`UPDATE "StockItem" SET "purchasePrice" = NULL`);
      });
    } catch (err) {
      running = false;
      logger.error('panic: не удалось очистить базу', { err });
      return false;
    }

    // Дальше — по возможности: сбой одного шага не отменяет остальные
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try { await fn(); } catch (err) { logger.error(`panic: ${name}`, { err }); }
    };
    // Старые версии строк с ценами склада физически убираются с диска
    await step('VACUUM склада', () => prisma.$executeRawUnsafe(`VACUUM FULL "StockItem"`));
    await step('CHECKPOINT', () => prisma.$executeRawUnsafe('CHECKPOINT'));
    // 3. Все устройства — на экран входа (при выходе клиент чистит кеш данных)
    await step('отзыв сессий', () => revokeAllSessions());
    // 4. Бэкапы хоста
    if (env.backupsDir) await step('удаление бэкапов', () => emptyDir(env.backupsDir));
    logger.warn('panic: база зашифрована и очищена');

    void encryptUploadsAndCleanup(dir);
    return true;
  },
};
