/**
 * Номер для ссылок мессенджеров — только цифры с кодом страны (375291234567).
 * Белорусский номер без кода (80 29… или 29…) дополняется кодом 375.
 * Слишком короткий номер — null: ссылки не показываем.
 */
export function messengerPhone(phone: string | null | undefined): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('80')) digits = `375${digits.slice(2)}`;
  else if (digits.length === 9) digits = `375${digits}`;
  return digits.length >= 10 ? digits : null;
}

/** Чат в Telegram — откроется, если клиент разрешил находить себя по номеру */
export const telegramHref = (digits: string) => `https://t.me/+${digits}`;

/** Чат в Viber — нужен установленный Viber (веб-версии нет) */
export const viberHref = (digits: string) => `viber://chat?number=%2B${digits}`;
