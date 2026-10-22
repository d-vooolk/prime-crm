#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ Pulling latest changes..."
git fetch origin main
git reset --hard origin/main

# Бэкап не перед деплоем, а каждую ночь в 03:30 UTC (база + data/uploads)
echo "→ Nightly backup cron..."
cat > /etc/cron.d/prime-crm-backup <<CRON
SHELL=/bin/bash
30 3 * * * root bash $SCRIPT_DIR/.deploy/backup.sh >> /var/log/prime-crm-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/prime-crm-backup

echo "→ Rebuilding and restarting containers..."
docker compose up --build -d

echo "→ Cleaning up unused images..."
docker image prune -f

echo "✓ Deploy complete"
