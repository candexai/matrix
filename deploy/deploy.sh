#!/usr/bin/env bash
# Build + (re)start both apps. Safe to re-run on every update.
#   bash /opt/matrix/deploy/deploy.sh            # pull latest main, build, restart
#   NO_PULL=1 bash /opt/matrix/deploy/deploy.sh  # build/restart what is on disk
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/matrix}"
cd "$APP_DIR"
[ -n "${NO_PULL:-}" ] || git pull --ff-only

echo "==> backend"
cd "$APP_DIR/backend"
[ -f .env ] || { echo "!! backend/.env missing"; exit 1; }
npm ci --no-audit --no-fund
npm run build

echo "==> frontend"
cd "$APP_DIR/frontend"
[ -f .env.production ] || { echo "!! frontend/.env.production missing (NEXT_PUBLIC_API_URL)"; exit 1; }
npm ci --no-audit --no-fund
npm run build

echo "==> pm2"
mkdir -p /var/log/matrix
pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.cjs" --update-env
pm2 save >/dev/null
pm2 status
echo "==> deployed $(git -C "$APP_DIR" rev-parse --short HEAD)"
