/**
 * Переменные окружения. Секреты обязательны: без них сервер не стартует, а не подставляет
 * общеизвестные значения по умолчанию (раньше так можно было подделать токен).
 * Значения в проде — в .env рядом с docker-compose.yml, в разработке — server/.env.development.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

export const env = {
  get jwtSecret() { return required('JWT_SECRET'); },
  get masterEmail() { return required('MASTER_EMAIL'); },
  get masterPassword() { return required('MASTER_PASSWORD'); },
  get clientUrl() { return process.env.CLIENT_URL || 'http://localhost:3000'; },
  get port() { return Number(process.env.PORT) || 3001; },
  get isProd() { return process.env.NODE_ENV === 'production'; },
  // Тревожная кнопка (services/panic.service.ts). Не заданы — кнопка ничего не делает
  get panicPublicKey() { return process.env.PANIC_PUBLIC_KEY || ''; },
  get panicPinHash() { return process.env.PANIC_PIN_HASH || ''; },
  /** Куда класть зашифрованный архив (в проде — data/panic на хосте) */
  get panicDir() { return process.env.PANIC_DIR || ''; },
  /** Папка бэкапов хоста, смонтированная в контейнер; пусто — бэкапы не трогаем */
  get backupsDir() { return process.env.BACKUPS_DIR || ''; },
  /** Общий ключ с магазином vdf.by (routes/integrations.routes.ts); пусто — приём заказов выключен */
  get vdfIntegrationKey() { return process.env.VDF_INTEGRATION_KEY || ''; },
  /** Адрес магазина vdf.by — туда передаётся «Протокол AID» (CRM→VDF); пусто — не передаём */
  get vdfUrl() { return (process.env.VDF_URL || '').replace(/\/+$/, ''); },
  /** Общий ключ с сайтом prime-auto.by (заявки из формы); пусто — приём заявок выключен */
  get siteLeadsKey() { return process.env.SITE_LEADS_KEY || ''; },
  /** Адрес страниц записи для клиента: ссылка в SMS — <адрес>/<код записи> */
  get publicRecordUrl() { return (process.env.PUBLIC_RECORD_URL || 'https://zapis.prime-auto.by').replace(/\/+$/, ''); },
  // Почтовый ящик (services/mail.service.ts). Нет логина или пароля — приём почты выключен
  get mailImapHost() { return process.env.MAIL_IMAP_HOST || 'imap.beget.com'; },
  get mailImapPort() { return Number(process.env.MAIL_IMAP_PORT) || 993; },
  get mailUser() { return process.env.MAIL_USER || ''; },
  get mailPassword() { return process.env.MAIL_PASSWORD || ''; },
};

/** Проверка при старте — падаем сразу, а не на первом входе пользователя. */
export function assertEnv() {
  for (const name of ['DATABASE_URL', 'JWT_SECRET', 'MASTER_EMAIL', 'MASTER_PASSWORD']) required(name);
}
