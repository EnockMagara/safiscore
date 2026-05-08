#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# One-time DigitalOcean droplet setup — Docker edition
# Run as root:  bash setup-docker.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> Updating system packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo "==> Creating deploy user..."
id -u deploy &>/dev/null || useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> Creating app directory..."
mkdir -p /var/www/safipoints
chown -R deploy:deploy /var/www/safipoints

echo ""
echo "============================================="
echo "  Docker server setup complete!"
echo "  Next steps:"
echo "  1. As deploy user: git clone the repo to /var/www/safipoints"
echo "  2. Create /var/www/safipoints/.env with production values"
echo "  3. Run: docker compose -f docker-compose.yml up -d"
echo "============================================="
