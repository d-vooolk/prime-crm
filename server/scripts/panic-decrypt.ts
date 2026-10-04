/**
 * Расшифровка архива тревожной кнопки. Запускать на своём компьютере:
 *
 *   npm run panic:decrypt -- <папка с архивом>
 *
 * Приватный ключ вводится скрыто. Рядом с .enc появляются database.sql.gz и uploads.tar.gz.
 * Как вернуть их на сервер — .deploy/README-panic.md.
 */
import fs from 'fs';
import path from 'path';
import { decryptPanicFile, parseHexKey } from '../src/utils/panicCrypto';
import { askHidden } from './askHidden';

async function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) throw new Error('Укажите папку с архивом: npm run panic:decrypt -- <папка>');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.enc'));
  if (!files.length) throw new Error(`В папке ${dir} нет файлов .enc`);

  const key = await askHidden('Приватный ключ (можно с пробелами): ');
  parseHexKey(key, 'Приватный ключ');

  for (const file of files) {
    const out = path.join(dir, file.replace(/\.enc$/, ''));
    process.stdout.write(`${file} → ${path.basename(out)} … `);
    await decryptPanicFile(path.join(dir, file), out, key);
    console.log('готово');
  }
  console.log('\nАрхив расшифрован и проверен. Дальше — .deploy/README-panic.md, раздел «Восстановление».');
}

main().catch((e) => {
  console.error(`\nОшибка: ${(e as Error).message}`);
  process.exit(1);
});
