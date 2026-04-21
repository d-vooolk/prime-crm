#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ Pulling latest changes..."
git pull origin main

echo "→ Rebuilding and restarting containers..."
docker-compose up --build -d

echo "→ Cleaning up unused images..."
docker image prune -f

echo "✓ Deploy complete"
