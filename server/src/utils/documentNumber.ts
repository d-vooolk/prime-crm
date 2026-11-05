import crypto from 'crypto';

/**
 * Номер заявки/акта: префикс и 6 случайных цифр (ПА-482915), без порядкового смысла —
 * по номеру не видно, сколько записей было. Первая цифра не ноль, чтобы номер не
 * совпал с прежними порядковыми (ПА-000123).
 */
export function randomDocumentNumber(prefix: string): string {
  return `${prefix}-${crypto.randomInt(100000, 1000000)}`;
}

/** Случайный номер, которого ещё нет; isTaken проверяет по базе */
export async function uniqueDocumentNumber(
  prefix: string,
  isTaken: (documentNumber: string) => Promise<boolean>,
  attempts = 20,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const documentNumber = randomDocumentNumber(prefix);
    if (!(await isTaken(documentNumber))) return documentNumber;
  }
  throw new Error('Не удалось подобрать свободный номер документа');
}
