#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Deployment script — runs ON the droplet via GitHub Actions
# Images are pre-built in CI and pushed to ghcr.io
# Server only pulls and restarts — no building on the droplet
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/safipoints"

cd "$APP_DIR"

# Pull latest compose config
git fetch origin main && git reset --hard origin/main

# Pull pre-built images from ghcr.io
docker compose -f docker-compose.yml pull

# Restart containers with new images (zero-downtime for unchanged services)
docker compose -f docker-compose.yml up -d

# Clean up dangling images
docker image prune -f

echo "✅ Deployment complete!"
