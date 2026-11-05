/**
 * Записывает тестовые ключи тревожной кнопки в server/.env.development (локально, не для прода).
 *
 *   npm run panic:setup:keys
 *
 * Генерирует пару ключей и хеш фиксированного тестового PIN, дописывает PANIC_PUBLIC_KEY и
 * PANIC_PIN_HASH в .env.development (если их там ещё нет) и печатает приватный ключ и PIN,
 * чтобы потом расшифровать архив (npm run panic:decrypt). Повторный запуск ничего не портит.
 */
import fs from 'fs';
import path from 'path';
import { generatePanicKeyPair, hashPanicPin } from '../src/utils/panicCrypto';

const TEST_PIN = '1234';
const envPath = path.resolve(__dirname, '..', '.env.development');

function main() {
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (/^PANIC_PUBLIC_KEY=.+/m.test(env) && /^PANIC_PIN_HASH=.+/m.test(env)) {
    console.log('PANIC_PUBLIC_KEY и PANIC_PIN_HASH уже заданы в .env.development — ничего не меняю.');
    console.log('Приватный ключ для расшифровки должен быть сохранён при первой настройке.');
    return;
  }

  const { publicKey, privateKey } = generatePanicKeyPair();
  const pinHash = hashPanicPin(TEST_PIN);

  const lines: string[] = [];
  if (!/^PANIC_PUBLIC_KEY=.+/m.test(env)) lines.push(`PANIC_PUBLIC_KEY=${publicKey}`);
  if (!/^PANIC_PIN_HASH=.+/m.test(env)) lines.push(`PANIC_PIN_HASH=${pinHash}`);
  if (!env.endsWith('\n') && env.length) env += '\n';
  fs.writeFileSync(envPath, `${env}\n# Тревожная кнопка (локальный тест)\n${lines.join('\n')}\n`);

  console.log('\nВ .env.development добавлены PANIC_PUBLIC_KEY и PANIC_PIN_HASH.');
  console.log(`\n  Тестовый PIN:     ${TEST_PIN}`);
  console.log(`  Приватный ключ:   ${privateKey}`);
  console.log('\nСохраните приватный ключ — только им расшифровывается архив (npm run panic:decrypt).\n');
}

main();
