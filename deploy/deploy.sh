#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deployment script — runs ON the droplet via GitHub Actions
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/safipoints"
REPO_URL="$1"

cd "$APP_DIR"

# Pull latest code
if [ -d .git ]; then
  git fetch origin main
  git reset --hard origin/main
else
  git clone "$REPO_URL" .
fi

# Install server dependencies (production only)
cd "$APP_DIR/server"
npm ci --omit=dev

# Install client dependencies & build React app
cd "$APP_DIR/client"
npm ci
npm run build

# Restart API with PM2
cd "$APP_DIR"
pm2 startOrRestart ecosystem.config.js --env production
pm2 save

# Reload Nginx
sudo systemctl restart nginx

echo "✅ Deployment complete!"
