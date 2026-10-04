#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ Pulling latest changes..."
git fetch origin main
git reset --hard origin/main

# Бэкап перед каждым деплоем: если миграция пойдёт не так, есть свежий дамп
echo "→ Backup before deploy..."
bash .deploy/backup.sh

echo "→ Rebuilding and restarting containers..."
docker compose up --build -d

echo "→ Cleaning up unused images..."
docker image prune -f

echo "✓ Deploy complete"
