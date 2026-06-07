#!/usr/bin/env bash
# News Command Center — Standalone Installer (PostgreSQL + Node.js, no Supabase)
# Ubuntu 22.04 / 24.04
set -euo pipefail

APP_NAME="news-cc"
APP_DIR="${APP_DIR:-$HOME/news-command-center}"
APP_PORT="${APP_PORT:-3000}"
DOMAIN="${DOMAIN:-}"

PG_DB="${PG_DB:-news_cc}"
PG_USER="${PG_USER:-news_cc}"
PG_PASS="${PG_PASS:-$(openssl rand -hex 16)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

log() { echo -e "\e[1;36m[i]\e[0m $*"; }
ok()  { echo -e "\e[1;32m[+]\e[0m $*"; }

sudo -v

log "Install Node.js 20 + PostgreSQL 16 + Nginx ..."
sudo apt-get update -y
sudo apt-get install -y curl git build-essential ufw nginx openssl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo npm i -g pm2

log "Setup database $PG_DB / user $PG_USER ..."
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$PG_USER') THEN
    CREATE ROLE $PG_USER LOGIN PASSWORD '$PG_PASS';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE $PG_DB OWNER $PG_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='$PG_DB')\gexec
GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;
SQL

cd "$APP_DIR/vps-standalone"
cat > .env <<EOT
DATABASE_URL=postgresql://$PG_USER:$PG_PASS@localhost:5432/$PG_DB
JWT_SECRET=$JWT_SECRET
PORT=$APP_PORT
NODE_ENV=production
FRONTEND_DIST=$APP_DIR/dist
COOKIE_DOMAIN=$DOMAIN
EOT
chmod 600 .env

log "Install deps + migrate + seed ..."
npm ci || npm install
npm run db:migrate
npm run db:seed

log "Build frontend di $APP_DIR ..."
cd "$APP_DIR"
if [ -f package.json ]; then
  if command -v bun >/dev/null; then bun install && bun run build; else npm install && npm run build; fi
fi

log "Start backend dengan PM2 ..."
cd "$APP_DIR/vps-standalone"
pm2 delete $APP_NAME >/dev/null 2>&1 || true
pm2 start npm --name $APP_NAME -- start
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME | tail -n1 | bash || true

if [ -n "$DOMAIN" ]; then
  log "Nginx reverse proxy untuk $DOMAIN ..."
  sudo tee /etc/nginx/sites-available/$APP_NAME >/dev/null <<NGX
server {
  listen 80;
  server_name $DOMAIN;
  client_max_body_size 10M;

  location /api/ws {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_read_timeout 86400s;
  }
  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGX
  sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
  sudo nginx -t && sudo systemctl reload nginx
fi

sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true
sudo ufw --force enable || true

ok "Selesai!"
echo "  DB    : $PG_DB / $PG_USER / $PG_PASS"
echo "  Admin : username=admin password=admin123  (GANTI SEGERA)"
echo "  URL   : http://${DOMAIN:-<server-ip>}"
echo "  HTTPS : sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN"