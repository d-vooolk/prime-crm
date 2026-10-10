import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Код страницы записи для клиента: 12 случайных букв и цифр (~71 бит). Ссылка короткая
 * (влезает в SMS), а подобрать чужую запись перебором нельзя.
 */
export function generatePublicToken(length = 12): string {
  // 248 = 62 × 4: байты от 248 отбрасываем, чтобы символы выпадали равновероятно
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte < 248 && out.length < length) out += ALPHABET[byte % 62];
    }
  }
  return out;
}

/** Похоже ли на код страницы — отсекаем мусор до запроса в базу */
export function isPublicTokenFormat(value: string): boolean {
  return /^[A-Za-z0-9]{8,32}$/.test(value);
}
