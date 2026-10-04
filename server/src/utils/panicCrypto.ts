import crypto from 'crypto';
import fs from 'fs';
import { Readable, Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Шифрование архива «тревожной кнопки» открытым ключом владельца.
 * На сервере лежит только открытый ключ: он умеет шифровать, но не расшифровывать.
 * Приватный ключ (64 hex-символа) хранится у владельца на бумаге и нужен только для восстановления.
 *
 * Схема — ECIES на стандартной криптографии Node, без сторонних библиотек:
 * одноразовый ключ X25519 + ключ владельца → общий секрет → HKDF-SHA256 → AES-256-GCM.
 *
 * Формат файла:
 *   MAGIC (10) | открытый ключ владельца (32) | одноразовый открытый ключ (32) | IV (12) | шифротекст | тег GCM (16)
 * Открытый ключ владельца в заголовке не секретный — по нему расшифровка сразу говорит «ключ не тот».
 */

export const PANIC_MAGIC = Buffer.from('PCRMPANIC1', 'ascii');
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
export const PANIC_HEADER_LEN = PANIC_MAGIC.length + KEY_LEN * 2 + IV_LEN;
export const PANIC_TAG_LEN = TAG_LEN;
const HKDF_INFO = Buffer.from('prime-crm panic v1', 'ascii');

// DER-префиксы ключей X25519: дальше идут 32 байта самого ключа
const SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');

/** Ключ из 64 hex-символов; пробелы и дефисы (как переписан с бумаги) игнорируются */
export function parseHexKey(text: string, what: string): Buffer {
  const hex = text.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`${what}: нужно ровно 64 символа 0-9 и a-f`);
  return Buffer.from(hex, 'hex');
}

const publicKeyObject = (raw: Buffer) =>
  crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });

const privateKeyObject = (raw: Buffer) =>
  crypto.createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, raw]), format: 'der', type: 'pkcs8' });

const rawPublic = (key: crypto.KeyObject) => key.export({ format: 'der', type: 'spki' }).subarray(SPKI_PREFIX.length);
const rawPrivate = (key: crypto.KeyObject) => key.export({ format: 'der', type: 'pkcs8' }).subarray(PKCS8_PREFIX.length);

/** Новая пара ключей владельца (hex) */
export function generatePanicKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return { publicKey: rawPublic(publicKey).toString('hex'), privateKey: rawPrivate(privateKey).toString('hex') };
}

/** Открытый ключ, соответствующий приватному (hex) */
export function publicKeyFromPrivate(privateKeyHex: string): string {
  const priv = privateKeyObject(parseHexKey(privateKeyHex, 'Приватный ключ'));
  return rawPublic(crypto.createPublicKey(priv)).toString('hex');
}

function deriveKey(shared: Buffer, ephemeralPub: Buffer, recipientPub: Buffer) {
  const salt = Buffer.concat([ephemeralPub, recipientPub]);
  return Buffer.from(crypto.hkdfSync('sha256', shared, salt, HKDF_INFO, KEY_LEN));
}

/** Поток-шифратор: на входе открытые данные, на выходе файл описанного формата */
export function createPanicEncryptStream(recipientPublicKeyHex: string): Transform {
  const recipientPub = parseHexKey(recipientPublicKeyHex, 'Открытый ключ');
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const ephemeralPub = rawPublic(ephemeral.publicKey);
  const shared = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: publicKeyObject(recipientPub) });
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(shared, ephemeralPub, recipientPub), iv);
  let headerSent = false;

  return new Transform({
    transform(chunk: Buffer, _enc, cb: TransformCallback) {
      if (!headerSent) {
        this.push(Buffer.concat([PANIC_MAGIC, recipientPub, ephemeralPub, iv]));
        headerSent = true;
      }
      cb(null, cipher.update(chunk));
    },
    flush(cb: TransformCallback) {
      if (!headerSent) this.push(Buffer.concat([PANIC_MAGIC, recipientPub, ephemeralPub, iv]));
      this.push(cipher.final());
      cb(null, cipher.getAuthTag());
    },
  });
}

/**
 * Дешифратор по заголовку и тегу (тег — последние 16 байт файла, его читают заранее).
 * Шифротекст между ними подаётся в возвращённый поток. Ошибка в final() — файл повреждён или подменён.
 */
export function createPanicDecipher(header: Buffer, tag: Buffer, privateKeyHex: string): crypto.DecipherGCM {
  if (header.length !== PANIC_HEADER_LEN || !header.subarray(0, PANIC_MAGIC.length).equals(PANIC_MAGIC)) {
    throw new Error('Это не архив тревожной кнопки');
  }
  let offset = PANIC_MAGIC.length;
  const recipientPub = header.subarray(offset, offset += KEY_LEN);
  const ephemeralPub = header.subarray(offset, offset += KEY_LEN);
  const iv = header.subarray(offset, offset + IV_LEN);

  const priv = privateKeyObject(parseHexKey(privateKeyHex, 'Приватный ключ'));
  if (!rawPublic(crypto.createPublicKey(priv)).equals(recipientPub)) {
    throw new Error('Ключ не подходит к этому архиву (проверьте, нет ли опечатки)');
  }
  const shared = crypto.diffieHellman({ privateKey: priv, publicKey: publicKeyObject(ephemeralPub) });
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(shared, ephemeralPub, recipientPub), iv);
  decipher.setAuthTag(tag);
  return decipher;
}

/**
 * Расшифровать файл целиком. Результат пишется во временный файл и переименовывается
 * только после проверки тега — битый архив не оставит «как будто удачный» результат.
 */
export async function decryptPanicFile(inPath: string, outPath: string, privateKeyHex: string): Promise<void> {
  const { size } = await fs.promises.stat(inPath);
  if (size < PANIC_HEADER_LEN + TAG_LEN) throw new Error('Файл слишком короткий — архив повреждён');
  const fd = await fs.promises.open(inPath, 'r');
  const header = Buffer.alloc(PANIC_HEADER_LEN);
  const tag = Buffer.alloc(TAG_LEN);
  try {
    await fd.read(header, 0, PANIC_HEADER_LEN, 0);
    await fd.read(tag, 0, TAG_LEN, size - TAG_LEN);
  } finally {
    await fd.close();
  }
  const decipher = createPanicDecipher(header, tag, privateKeyHex);
  const tmp = `${outPath}.tmp`;
  try {
    await pipeline(
      // Пустые данные — шифротекста нет вовсе, а createReadStream не умеет пустой диапазон
      size === PANIC_HEADER_LEN + TAG_LEN
        ? Readable.from([])
        : fs.createReadStream(inPath, { start: PANIC_HEADER_LEN, end: size - TAG_LEN - 1 }),
      decipher,
      fs.createWriteStream(tmp),
    );
  } catch (e) {
    await fs.promises.rm(tmp, { force: true });
    throw new Error(`Архив повреждён или изменён: ${(e as Error).message}`);
  }
  await fs.promises.rename(tmp, outPath);
}

// ─── PIN ───────────────────────────────────────────
// В .env лежит только хеш: «соль:хеш» scrypt в hex. Сам PIN нигде не хранится.

export function hashPanicPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPanicPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex || !/^[0-9a-f]+$/i.test(saltHex + hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
