/**
 * Пара ключей тревожной кнопки. Запускать на СВОЁМ компьютере, не на сервере:
 *
 *   npm run panic:keygen
 *
 * Открытый ключ → PANIC_PUBLIC_KEY в .env на сервере.
 * Приватный ключ → переписать на бумагу; на диск скрипт его не сохраняет.
 */
import { generatePanicKeyPair, publicKeyFromPrivate } from '../src/utils/panicCrypto';

const { publicKey, privateKey } = generatePanicKeyPair();
// Самопроверка: из приватного ключа получается тот же открытый
if (publicKeyFromPrivate(privateKey) !== publicKey) throw new Error('Сбой генерации ключа, запустите ещё раз');

const groups = privateKey.match(/.{4}/g)!;

console.log(`
Открытый ключ — впишите в .env на сервере (не секретный):

PANIC_PUBLIC_KEY=${publicKey}

Приватный ключ — ПЕРЕПИШИТЕ НА БУМАГУ (только цифры 0-9 и буквы a-f):

    ${groups.slice(0, 8).join(' ')}
    ${groups.slice(8).join(' ')}

Без него зашифрованные данные не восстановить. Никуда его не отправляйте и не сохраняйте
на этом компьютере. После записи закройте окно терминала.
`);
