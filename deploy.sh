#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# После обновления скрипт перезапускает сам себя: иначе bash доиграет старую версию,
# уже открытую до git reset, и изменения в deploy.sh сработают только со следующего деплоя
if [ -z "${DEPLOY_UPDATED:-}" ]; then
  echo "→ Pulling latest changes..."
  git fetch origin main
  git reset --hard origin/main
  DEPLOY_UPDATED=1 exec bash "$SCRIPT_DIR/deploy.sh" "$@"
fi

# Бэкап не перед деплоем, а каждую ночь в 03:30 UTC (база + data/uploads)
echo "→ Nightly backup cron..."
cat > /etc/cron.d/prime-crm-backup <<CRON
SHELL=/bin/bash
30 3 * * * root bash $SCRIPT_DIR/.deploy/backup.sh >> /var/log/prime-crm-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/prime-crm-backup
# Раньше бэкап стоял в crontab root — убираем, чтобы не запускался дважды
crontab -l 2>/dev/null | grep -v '.deploy/backup.sh' | crontab - || true

echo "→ Rebuilding and restarting containers..."
docker compose up --build -d

echo "→ Cleaning up unused images..."
docker image prune -f

echo "✓ Deploy complete"
