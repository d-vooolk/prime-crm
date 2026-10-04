/**
 * Хеш PIN тревожной кнопки. Запускать на своём компьютере:
 *
 *   npm run panic:pin
 *
 * PIN вводится скрыто, в .env на сервере записывается только хеш (PANIC_PIN_HASH).
 */
import { hashPanicPin, verifyPanicPin } from '../src/utils/panicCrypto';
import { askHidden } from './askHidden';

async function main() {
  const pin = (await askHidden('PIN (минимум 6 символов): ')).trim();
  if (pin.length < 6) throw new Error('PIN короче 6 символов');
  if (pin.length > 100) throw new Error('PIN длиннее 100 символов');
  const again = (await askHidden('Повторите PIN: ')).trim();
  if (again !== pin) throw new Error('PIN не совпадают');

  const hash = hashPanicPin(pin);
  if (!verifyPanicPin(pin, hash)) throw new Error('Сбой проверки хеша, запустите ещё раз');
  console.log(`\nВпишите в .env на сервере:\n\nPANIC_PIN_HASH=${hash}\n`);
}

main().catch((e) => {
  console.error(`Ошибка: ${(e as Error).message}`);
  process.exit(1);
});
