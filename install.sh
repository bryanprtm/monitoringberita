#!/usr/bin/env bash
# =============================================================================
# NEWS COMMAND CENTER - Auto Installer for Ubuntu Server (22.04 / 24.04)
# -----------------------------------------------------------------------------
# Installs: Node.js 20, Bun, Git, Nginx, PM2, PostgreSQL (optional),
#           Supabase CLI (optional), then builds & runs the app.
#
# Usage (run as a user with sudo):
#   chmod +x install.sh
#   ./install.sh
# =============================================================================

set -euo pipefail

# ---- Config (edit these) ----------------------------------------------------
APP_NAME="news-command-center"
APP_DIR="${APP_DIR:-$HOME/$APP_NAME}"
GIT_REPO="${GIT_REPO:-}"                # e.g. https://github.com/USER/REPO.git
APP_PORT="${APP_PORT:-3000}"
DOMAIN="${DOMAIN:-}"                    # e.g. monitoring.example.com (optional)

# Lovable Cloud (Supabase) credentials — required at runtime
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://pglycymrdycyndhvdwiu.supabase.co}"
VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-pglycymrdycyndhvdwiu}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# Local PostgreSQL (only used if INSTALL_POSTGRES=1)
INSTALL_POSTGRES="${INSTALL_POSTGRES:-0}"
PG_DB="${PG_DB:-news_cc}"
PG_USER="${PG_USER:-news_cc}"
PG_PASS="${PG_PASS:-$(openssl rand -hex 16)}"

log()  { echo -e "\e[1;36m[i]\e[0m $*"; }
ok()   { echo -e "\e[1;32m[✓]\e[0m $*"; }
warn() { echo -e "\e[1;33m[!]\e[0m $*"; }
err()  { echo -e "\e[1;31m[x]\e[0m $*" >&2; }

require_sudo() {
  if ! sudo -n true 2>/dev/null; then
    log "Sudo password required."
    sudo -v
  fi
}

# ---- 1. System update + base packages --------------------------------------
install_base() {
  require_sudo
  log "Updating apt and installing base packages..."
  sudo apt-get update -y
  sudo apt-get install -y \
    curl wget git build-essential ca-certificates gnupg \
    unzip ufw nginx openssl
  ok "Base packages installed."
}

# ---- 2. Node.js 20 (NodeSource) --------------------------------------------
install_node() {
  if command -v node >/dev/null && [[ "$(node -v)" == v20.* || "$(node -v)" == v22.* ]]; then
    ok "Node.js already installed: $(node -v)"
    return
  fi
  log "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node.js installed: $(node -v)"
}

# ---- 3. Bun (preferred runtime for this project) ---------------------------
install_bun() {
  if command -v bun >/dev/null; then
    ok "Bun already installed: $(bun -v)"
    return
  fi
  log "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! grep -q 'BUN_INSTALL' "$HOME/.bashrc"; then
    echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
  fi
  ok "Bun installed: $(bun -v)"
}

# ---- 4. PM2 (process manager) ----------------------------------------------
install_pm2() {
  if command -v pm2 >/dev/null; then
    ok "PM2 already installed."
    return
  fi
  log "Installing PM2..."
  sudo npm install -g pm2
  ok "PM2 installed."
}

# ---- 5. Optional: local PostgreSQL -----------------------------------------
install_postgres() {
  [[ "$INSTALL_POSTGRES" == "1" ]] || { warn "Skipping PostgreSQL (INSTALL_POSTGRES=0)"; return; }
  log "Installing PostgreSQL 16..."
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl enable --now postgresql

  log "Creating database '$PG_DB' and user '$PG_USER'..."
  sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PG_USER') THEN
    CREATE ROLE $PG_USER LOGIN PASSWORD '$PG_PASS';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE $PG_DB OWNER $PG_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$PG_DB')\gexec
GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;
SQL

  log "Applying schema migrations from supabase/migrations/ ..."
  if [[ -d "$APP_DIR/supabase/migrations" ]]; then
    for f in "$APP_DIR"/supabase/migrations/*.sql; do
      log "  > $(basename "$f")"
      PGPASSWORD="$PG_PASS" psql -h localhost -U "$PG_USER" -d "$PG_DB" -f "$f" || warn "migration $f had errors (continuing)"
    done
  fi
  ok "PostgreSQL ready. DB=$PG_DB USER=$PG_USER PASS=$PG_PASS"
}

# ---- 6. Clone / update project ---------------------------------------------
fetch_project() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Project exists. Pulling latest..."
    git -C "$APP_DIR" pull --ff-only
  elif [[ -n "$GIT_REPO" ]]; then
    log "Cloning $GIT_REPO into $APP_DIR ..."
    git clone "$GIT_REPO" "$APP_DIR"
  else
    warn "GIT_REPO not set and $APP_DIR is not a git repo."
    warn "Place project files in $APP_DIR manually, then re-run this script."
    [[ -f "$APP_DIR/package.json" ]] || { err "No package.json found. Abort."; exit 1; }
  fi
  ok "Project ready at $APP_DIR"
}

# ---- 7. Write .env ---------------------------------------------------------
write_env() {
  log "Writing $APP_DIR/.env ..."
  cat > "$APP_DIR/.env" <<EOT
VITE_SUPABASE_URL="$VITE_SUPABASE_URL"
VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"
VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"
SUPABASE_URL="$VITE_SUPABASE_URL"
SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
PORT=$APP_PORT
EOT
  chmod 600 "$APP_DIR/.env"
  ok ".env written."
}

# ---- 8. Install deps & build -----------------------------------------------
build_app() {
  cd "$APP_DIR"
  log "Installing project dependencies (bun install)..."
  bun install
  log "Building production bundle (bun run build)..."
  bun run build
  ok "Build finished."
}

# ---- 9. Start with PM2 -----------------------------------------------------
start_pm2() {
  cd "$APP_DIR"
  log "Starting app with PM2 on port $APP_PORT ..."
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  PORT=$APP_PORT pm2 start "bun run preview -- --port $APP_PORT --host 0.0.0.0" --name "$APP_NAME"
  pm2 save
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n1 | bash || true
  ok "App running under PM2 ($APP_NAME)."
}

# ---- 10. Nginx reverse proxy -----------------------------------------------
setup_nginx() {
  [[ -n "$DOMAIN" ]] || { warn "DOMAIN not set, skipping nginx vhost."; return; }
  log "Configuring Nginx for $DOMAIN -> 127.0.0.1:$APP_PORT ..."
  sudo tee /etc/nginx/sites-available/$APP_NAME >/dev/null <<NGX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGX
  sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
  sudo nginx -t && sudo systemctl reload nginx
  ok "Nginx configured for http://$DOMAIN"
  warn "For HTTPS run:  sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN"
}

# ---- 11. Firewall ----------------------------------------------------------
setup_firewall() {
  log "Configuring UFW (OpenSSH + Nginx)..."
  sudo ufw allow OpenSSH >/dev/null || true
  sudo ufw allow 'Nginx Full' >/dev/null || true
  sudo ufw --force enable >/dev/null || true
  ok "Firewall enabled."
}

main() {
  log "=== NEWS COMMAND CENTER installer starting ==="
  install_base
  install_node
  install_bun
  install_pm2
  fetch_project
  install_postgres
  write_env
  build_app
  start_pm2
  setup_nginx
  setup_firewall
  echo
  ok "Done! App: http://$( [[ -n "$DOMAIN" ]] && echo "$DOMAIN" || echo "<server-ip>:$APP_PORT" )"
  log "Manage with:  pm2 status | pm2 logs $APP_NAME | pm2 restart $APP_NAME"
}

main "$@"
