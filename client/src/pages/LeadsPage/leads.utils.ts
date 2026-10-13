/**
 * Телефон из заявки → формат поля записи «+375 (29) 123-45-67». На сайте маска подгружается
 * не сразу, поэтому приходят и «80291234567», и «+375291234567». Не белорусский номер —
 * как есть: менеджер поправит руками
 */
export function toCrmPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('80')) digits = `375${digits.slice(2)}`;
  if (digits.length === 9) digits = `375${digits}`;
  if (digits.length !== 12 || !digits.startsWith('375')) return raw.trim();
  return `+375 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
}

/** Ссылка для звонка с телефона */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
