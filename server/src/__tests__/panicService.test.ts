import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { generatePanicKeyPair, decryptPanicFile } from '../utils/panicCrypto';

const keys = generatePanicKeyPair();
let encryptCommandOutput: typeof import('../services/panic.service').encryptCommandOutput;

beforeAll(async () => {
  process.env.PANIC_PUBLIC_KEY = keys.publicKey;
  process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
  ({ encryptCommandOutput } = await import('../services/panic.service'));
});

const tmpDir = () => fs.promises.mkdtemp(path.join(os.tmpdir(), 'panic-svc-'));

describe('panic: шифрование вывода команды', () => {
  it('вывод команды сжимается, шифруется и расшифровывается обратно', async () => {
    const dir = await tmpDir();
    const out = path.join(dir, 'db.sql.gz.enc');
    await encryptCommandOutput(process.execPath, ['-e', 'process.stdout.write("CREATE TABLE x;".repeat(5000))'], out, true);
    expect(fs.existsSync(`${out}.tmp`)).toBe(false);
    await decryptPanicFile(out, path.join(dir, 'db.sql.gz'), keys.privateKey);
    const sql = zlib.gunzipSync(await fs.promises.readFile(path.join(dir, 'db.sql.gz'))).toString();
    expect(sql).toBe('CREATE TABLE x;'.repeat(5000));
  });

  it('команда упала — ошибка, архива нет', async () => {
    const dir = await tmpDir();
    const out = path.join(dir, 'db.sql.gz.enc');
    await expect(encryptCommandOutput(process.execPath, ['-e', 'process.stdout.write("частично"); process.exit(2)'], out, true))
      .rejects.toThrow('кодом 2');
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.existsSync(`${out}.tmp`)).toBe(false);
  });

  it('команды нет — ошибка, архива нет', async () => {
    const dir = await tmpDir();
    const out = path.join(dir, 'db.sql.gz.enc');
    await expect(encryptCommandOutput('pg_dump_которого_нет', [], out, true)).rejects.toThrow();
    expect(fs.existsSync(out)).toBe(false);
  });
});
