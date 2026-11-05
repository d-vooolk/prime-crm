#!/usr/bin/env bash
# Разовая подготовка локальной проверки тревожной кнопки через UI.
#
#   bash scripts/local-panic-test.sh      (из папки server)
#
# Делает всё, что можно сделать без интерактива:
#   1) поднимает контейнер Postgres prime-pg (если не запущен);
#   2) применяет миграции;
#   3) кладёт тестовые ключи протокола в .env.development;
#   4) создаёт обёртку pg_dump → выполняется внутри контейнера (на маке pg_dump нет);
#   5) обильно засевает демо-данные.
# После — печатает шаги запуска сервера и клиента (их запускаете вы, два терминала).
set -euo pipefail

cd "$(dirname "$0")/.."   # папка server
BIN="$HOME/.local/bin"

echo "==> 1/5 Postgres (контейнер prime-pg)"
if ! command -v docker >/dev/null 2>&1; then
  echo "docker не найден в PATH. Запустите Docker Desktop и повторите." >&2; exit 1
fi
if [ -z "$(docker ps -q -f name='^prime-pg$')" ]; then
  if [ -n "$(docker ps -aq -f name='^prime-pg$')" ]; then
    docker start prime-pg
  else
    docker run -d --name prime-pg -p 5432:5432 \
      -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prime_crm postgres:16
  fi
  echo "   жду готовности базы..."
  until docker exec prime-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
else
  echo "   уже запущен"
fi

echo "==> 2/5 Миграции"
npm run db:migrate:prod  # deploy: применяет имеющиеся миграции без вопросов

echo "==> 3/5 Ключи протокола в .env.development"
npx ts-node scripts/panic-setup-keys.ts

echo "==> 4/5 Обёртка pg_dump (через контейнер)"
mkdir -p "$BIN"
cat > "$BIN/pg_dump" <<'WRAP'
#!/bin/sh
exec docker exec -i prime-pg pg_dump "$@"
WRAP
chmod +x "$BIN/pg_dump"
echo "   создан $BIN/pg_dump"

echo "==> 5/5 Демо-данные"
npm run db:seed:demo

cat <<'NEXT'

========================================================================
Готово. Теперь запустите в ДВУХ терминалах:

  # терминал 1 — сервер (с pg_dump в PATH)
  cd server
  PATH="$HOME/.local/bin:$PATH" npm run dev

  # терминал 2 — клиент
  cd client
  npm run dev

Откройте http://localhost:3000 и войдите мастером
(MASTER_EMAIL / MASTER_PASSWORD из server/.env.development)
или тестовым сотрудником: creator@test / director@test / manager@test / petr@test (пароль test1234)

Тревожная кнопка: Настройки → Протокол AID → 3 подтверждения → PIN 1234.
Смотрите прогрессбар, затем вас разлогинит и CRM перейдёт в облегчённый режим.

Сброс для повторного теста:
  cd server && npm run db:seed:demo        (пересоздаст данные и вернёт обычный режим)
========================================================================
NEXT
