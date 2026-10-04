import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  createPanicEncryptStream, decryptPanicFile, generatePanicKeyPair, hashPanicPin,
  parseHexKey, publicKeyFromPrivate, verifyPanicPin, PANIC_HEADER_LEN,
} from '../utils/panicCrypto';

async function encryptToFile(data: Buffer, publicKey: string) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'panic-'));
  const file = path.join(dir, 'data.enc');
  // Несколько кусков — как настоящий поток pg_dump
  const chunks = [data.subarray(0, 7), data.subarray(7, 70_000), data.subarray(70_000)];
  await pipeline(Readable.from(chunks), createPanicEncryptStream(publicKey), fs.createWriteStream(file));
  return { dir, file, out: path.join(dir, 'data') };
}

describe('panicCrypto: ключи', () => {
  it('открытый ключ получается из приватного', () => {
    const { publicKey, privateKey } = generatePanicKeyPair();
    expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(publicKeyFromPrivate(privateKey)).toBe(publicKey);
  });

  it('ключ, переписанный с бумаги с пробелами и в верхнем регистре, принимается', () => {
    const { privateKey } = generatePanicKeyPair();
    const paper = privateKey.toUpperCase().match(/.{4}/g)!.join(' ');
    expect(parseHexKey(paper, 'ключ').toString('hex')).toBe(privateKey);
  });

  it('неверная длина или символы — ошибка', () => {
    expect(() => parseHexKey('abc', 'ключ')).toThrow();
    expect(() => parseHexKey('z'.repeat(64), 'ключ')).toThrow();
  });
});

describe('panicCrypto: шифрование', () => {
  it('зашифрованное расшифровывается верным ключом', async () => {
    const { publicKey, privateKey } = generatePanicKeyPair();
    const data = crypto.randomBytes(150_000);
    const { file, out } = await encryptToFile(data, publicKey);
    const encrypted = await fs.promises.readFile(file);
    expect(encrypted.includes(data.subarray(0, 32))).toBe(false);
    await decryptPanicFile(file, out, privateKey);
    expect((await fs.promises.readFile(out)).equals(data)).toBe(true);
  });

  it('пустые данные тоже шифруются', async () => {
    const { publicKey, privateKey } = generatePanicKeyPair();
    const { file, out } = await encryptToFile(Buffer.alloc(0), publicKey);
    await decryptPanicFile(file, out, privateKey);
    expect((await fs.promises.readFile(out)).length).toBe(0);
  });

  it('чужой ключ — понятная ошибка, файл результата не создаётся', async () => {
    const { publicKey } = generatePanicKeyPair();
    const other = generatePanicKeyPair();
    const { file, out } = await encryptToFile(Buffer.from('секрет'), publicKey);
    await expect(decryptPanicFile(file, out, other.privateKey)).rejects.toThrow('Ключ не подходит');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('изменённый архив не расшифровывается', async () => {
    const { publicKey, privateKey } = generatePanicKeyPair();
    const { file, out } = await encryptToFile(crypto.randomBytes(1000), publicKey);
    const buf = await fs.promises.readFile(file);
    buf[PANIC_HEADER_LEN + 10] ^= 1;
    await fs.promises.writeFile(file, buf);
    await expect(decryptPanicFile(file, out, privateKey)).rejects.toThrow('повреждён');
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.existsSync(`${out}.tmp`)).toBe(false);
  });
});

describe('panicCrypto: PIN', () => {
  it('верный PIN проходит, неверный — нет', () => {
    const hash = hashPanicPin('482915');
    expect(verifyPanicPin('482915', hash)).toBe(true);
    expect(verifyPanicPin('482916', hash)).toBe(false);
    expect(verifyPanicPin('', hash)).toBe(false);
  });

  it('у одинаковых PIN разные хеши (соль)', () => {
    expect(hashPanicPin('482915')).not.toBe(hashPanicPin('482915'));
  });

  it('испорченный хеш в .env — не проходит, а не падает', () => {
    expect(verifyPanicPin('482915', '')).toBe(false);
    expect(verifyPanicPin('482915', 'мусор')).toBe(false);
  });
});
