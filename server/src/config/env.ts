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
};

/** Проверка при старте — падаем сразу, а не на первом входе пользователя. */
export function assertEnv() {
  for (const name of ['DATABASE_URL', 'JWT_SECRET', 'MASTER_EMAIL', 'MASTER_PASSWORD']) required(name);
}
