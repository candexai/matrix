#!/usr/bin/env bash
# One-time server provisioning for Matrix × CandexAI (Ubuntu/Debian, run as root).
#   DOMAIN=edu.candexai.co.in REPO=https://github.com/candexai/matrix.git bash setup-server.sh
set -euo pipefail
DOMAIN="${DOMAIN:-edu.candexai.co.in}"
REPO="${REPO:-https://github.com/candexai/matrix.git}"
APP_DIR="${APP_DIR:-/opt/matrix}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx ufw apache2-utils ca-certificates gnupg >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
  echo "==> node ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v; npm -v
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null

if ! command -v certbot >/dev/null; then
  echo "==> certbot"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
fi

echo "==> code"
mkdir -p /var/log/matrix
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$APP_DIR"; fi

echo "==> nginx"
install -m 644 "$APP_DIR/deploy/matrix-proxy.conf" /etc/nginx/snippets/matrix-proxy.conf
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf.template" > /etc/nginx/sites-available/matrix
ln -sf /etc/nginx/sites-available/matrix /etc/nginx/sites-enabled/matrix
# Other sites on this server are left untouched (no default-site removal).
[ -f /etc/nginx/matrix.htpasswd ] || { echo "!! /etc/nginx/matrix.htpasswd missing — create it with: htpasswd -c /etc/nginx/matrix.htpasswd <user>"; }
nginx -t && systemctl enable --now nginx && systemctl reload nginx

if [ "${ENABLE_UFW:-0}" = "1" ]; then
  echo "==> firewall (ENABLE_UFW=1)"
  ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null; ufw status | head -5
else
  echo "==> firewall untouched (set ENABLE_UFW=1 to enable ufw; check other services' ports first)"
fi

echo "==> done. Next: put env files in place, then run: bash $APP_DIR/deploy/deploy.sh"
