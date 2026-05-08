#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# One-time DigitalOcean droplet setup for SafiPoints
# Run as root:  bash setup-server.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> Updating system packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Installing Nginx..."
apt-get install -y nginx

echo "==> Installing PM2 globally..."
npm install -g pm2

echo "==> Installing MongoDB 7..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org
systemctl enable mongod
systemctl start mongod

echo "==> Creating deploy user..."
id -u deploy &>/dev/null || useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Allow deploy user to restart nginx & pm2 without password
echo "deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/pm2, /usr/bin/systemctl restart nginx" \
  > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

echo "==> Creating app directory..."
mkdir -p /var/www/safipoints
chown -R deploy:deploy /var/www/safipoints

echo "==> Setting up Nginx site..."
rm -f /etc/nginx/sites-enabled/default

echo "==> Setting up PM2 startup..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

echo ""
echo "============================================="
echo "  Server setup complete!"
echo "  Next steps:"
echo "  1. Copy deploy/nginx.conf to /etc/nginx/sites-available/safipoints"
echo "  2. ln -s /etc/nginx/sites-available/safipoints /etc/nginx/sites-enabled/"
echo "  3. Create /var/www/safipoints/.env with production values"
echo "  4. systemctl restart nginx"
echo "============================================="
