/* eslint-disable */
// Применение миграций при старте контейнера (вызывается из Dockerfile перед запуском сервера).
//
// До октября 2026 схема синхронизировалась `prisma db push --accept-data-loss`, и таблицы
// _prisma_migrations в боевой базе нет. Базовая миграция 0_init описывает ровно ту схему,
// поэтому для такой базы она помечается применённой, а не выполняется. Пустая база получает
// все миграции целиком. Дальше — обычный `prisma migrate deploy`, который никогда не удаляет
// данные молча: опасное изменение должно быть явно написано в файле миграции.
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const BASELINE = '0_init';
const prismaBin = 'node_modules/.bin/prisma';

function prisma(...args) {
  execFileSync(prismaBin, args, { stdio: 'inherit' });
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT to_regclass('public._prisma_migrations') AS migrations, to_regclass('public."Client"') AS app`,
    );
    const { migrations, app } = rows[0];
    if (!migrations && app) {
      console.log(`[migrate] База без истории миграций — помечаю ${BASELINE} применённой`);
      prisma('migrate', 'resolve', '--applied', BASELINE);
    }
  } finally {
    await client.end();
  }
  prisma('migrate', 'deploy');
}

main().catch((e) => {
  console.error('[migrate] Ошибка миграции, сервер не запущен:', e.message);
  process.exit(1);
});
