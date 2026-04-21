#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# If run locally (not on the server), push first and deploy remotely
if [ "$1" != "--server" ]; then
  echo "→ Pushing to origin..."
  git push origin main
  echo "→ Deploying on server..."
  ssh root@217.12.37.199 "cd /root/prime-crm && bash deploy.sh --server"
  echo "✓ Deploy triggered"
  exit 0
fi

# --- Below runs on server only ---
echo "→ Pulling latest changes..."
git fetch origin main
git reset --hard origin/main

echo "→ Rebuilding and restarting containers..."
docker compose up --build -d

echo "→ Cleaning up unused images..."
docker image prune -f

echo "✓ Deploy complete"
