#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# First-time SSL setup for SafiPoints
# Run on the server as the deploy user:
#   bash deploy/init-ssl.sh your@email.com
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="safipoints.com"
EMAIL="${1:?Usage: bash deploy/init-ssl.sh your@email.com}"
APP_DIR="/var/www/safipoints"

cd "$APP_DIR"

echo "==> Step 1: Starting containers with HTTP-only Nginx config..."
cp deploy/nginx-init.conf deploy/nginx-active.conf
docker compose -f docker-compose.yml down 2>/dev/null || true

# Temporarily use init config
docker compose -f docker-compose.yml up -d mongo api client
sleep 5

# Start nginx with init config (HTTP-only, no SSL)
docker compose -f docker-compose.yml run -d --name safipoints-nginx-init \
  -p 80:80 \
  -v "$APP_DIR/deploy/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v safipoints_certbot_www:/var/www/certbot:ro \
  nginx

echo "==> Step 2: Obtaining SSL certificate from Let's Encrypt..."
docker compose -f docker-compose.yml run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Step 3: Switching to HTTPS Nginx config..."
docker stop safipoints-nginx-init && docker rm safipoints-nginx-init

# Start everything with the full SSL config
docker compose -f docker-compose.yml up -d

echo ""
echo "============================================="
echo "  SSL setup complete!"
echo "  https://safipoints.com is now live"
echo ""

echo "  Auto-renewal: add this cron job (as deploy):"
echo "  0 3 * * * cd $APP_DIR && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload"
echo "============================================="
