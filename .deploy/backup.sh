#!/bin/bash
# Ежедневный бэкап CRM: дамп базы + снимок загруженных файлов (фото/видео вики и записей).
# Запускается cron'ом на сервере (см. .deploy/README-backup.md).
#
# Хранение (схема «дед-отец-сын»), чтобы не забивать диск и при этом иметь глубокую историю:
#   daily/   — последние 7 дней
#   weekly/  — по воскресеньям, последние 5 недель
#   monthly/ — 1-го числа, последние 12 месяцев
# Дамп базы весит ~1 МБ, так что вся история базы занимает десятки мегабайт.
# Файлы копируются rsync'ом с жёсткими ссылками на предыдущий снимок: неизменившиеся
# фото не дублируются, каждый снимок занимает место только под новые файлы.
#
# Если задан RCLONE_REMOTE (например "yadisk:prime-crm-backup"), дамп базы и снимок файлов
# дополнительно копируются на внешнее хранилище — защита от потери самого сервера.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/prime-crm}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/prime-crm}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-5}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"

# Внешнее хранилище и прочие настройки можно задать в .env рядом с docker-compose.yml
if [ -f "$APP_DIR/.env" ]; then
  RCLONE_REMOTE="${RCLONE_REMOTE:-$(grep -E '^BACKUP_RCLONE_REMOTE=' "$APP_DIR/.env" | cut -d= -f2- || true)}"
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly,files}

log() { echo "[$(date '+%F %T')] $*"; }

cd "$APP_DIR"

# ─── База ───────────────────────────────────────────
DUMP="$BACKUP_DIR/daily/prime_crm_$STAMP.sql.gz"
# Сначала во временный файл: оборванный дамп не должен выглядеть как удачный
docker compose exec -T postgres pg_dump -U postgres --no-owner prime_crm | gzip > "$DUMP.tmp"
# Пустой или битый архив — ошибка, старые бэкапы при этом не трогаем
gzip -t "$DUMP.tmp"
if [ "$(stat -c %s "$DUMP.tmp")" -lt 10000 ]; then
  log "Дамп подозрительно маленький, бэкап прерван"; rm -f "$DUMP.tmp"; exit 1
fi
mv "$DUMP.tmp" "$DUMP"
log "База: $DUMP ($(du -h "$DUMP" | cut -f1))"

[ "$(date +%u)" = "7" ] && cp "$DUMP" "$BACKUP_DIR/weekly/"
[ "$(date +%d)" = "01" ] && cp "$DUMP" "$BACKUP_DIR/monthly/"

# ─── Файлы ──────────────────────────────────────────
SNAP="$BACKUP_DIR/files/$STAMP"
LAST="$(ls -1d "$BACKUP_DIR"/files/*/ 2>/dev/null | tail -1 || true)"
if [ -n "$LAST" ]; then
  rsync -a --delete --link-dest="$LAST" "$APP_DIR/data/uploads/" "$SNAP/"
else
  rsync -a "$APP_DIR/data/uploads/" "$SNAP/"
fi
log "Файлы: $SNAP"

# ─── Ротация ────────────────────────────────────────
rotate() { # каталог, сколько оставить
  ls -1t "$1" 2>/dev/null | tail -n +"$(( $2 + 1 ))" | while read -r f; do rm -rf "${1:?}/$f"; done
}
rotate "$BACKUP_DIR/daily" "$KEEP_DAILY"
rotate "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
rotate "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"
# Снимков файлов — как ежедневных: жёсткие ссылки делают их почти бесплатными
rotate "$BACKUP_DIR/files" "$KEEP_DAILY"

# ─── Внешнее хранилище ──────────────────────────────
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rclone copy "$DUMP" "$RCLONE_REMOTE/db/" && log "База скопирована в $RCLONE_REMOTE"
  rclone sync "$APP_DIR/data/uploads/" "$RCLONE_REMOTE/uploads/" && log "Файлы синхронизированы с $RCLONE_REMOTE"
  # На внешнем хранилище держим дампы за 90 дней
  rclone delete "$RCLONE_REMOTE/db/" --min-age 90d || true
fi

log "Готово"
