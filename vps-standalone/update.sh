#!/usr/bin/env bash
# =============================================================================
# update.sh — Update News Command Center di VPS
# =============================================================================
# Script ini dijalankan DI VPS (bukan di laptop) untuk:
#   1. Pull kode terbaru dari git
#   2. Rebuild frontend (Vite)
#   3. Install dep backend & jalankan migrasi DB baru
#   4. Restart service via PM2 + reload Nginx
#
# Aman dijalankan berulang kali (idempotent). Tidak menyentuh data DB.
#
# Cara pakai di VPS:
#   cd ~/news-command-center
#   bash vps-standalone/update.sh
#
# Optional ENV:
#   APP_DIR        default: direktori saat ini (harus root repo)
#   BACKEND_DIR    default: $APP_DIR/vps-standalone
#   PM2_NAME       default: news-cc
#   SKIP_FRONTEND  =1 untuk skip build frontend
#   SKIP_BACKEND   =1 untuk skip update backend
#   SKIP_MIGRATE   =1 untuk skip db:migrate
# =============================================================================

set -euo pipefail

# ---- helpers ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

# ---- config ----
APP_DIR="${APP_DIR:-$(pwd)}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/vps-standalone}"
PM2_NAME="${PM2_NAME:-news-cc}"

# ---- pre-flight ----
log "VPS Update — News Command Center"
echo "  APP_DIR      = $APP_DIR"
echo "  BACKEND_DIR  = $BACKEND_DIR"
echo "  PM2_NAME     = $PM2_NAME"
echo ""

if [ ! -d "$APP_DIR/.git" ]; then
  err "Bukan git repo: $APP_DIR"
  err "Jalankan dari root project (cd ~/news-command-center)"
  exit 1
fi

cd "$APP_DIR"

# ---- 0. Snapshot info kondisi sekarang ----
log "Snapshot versi saat ini..."
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  Commit sekarang: $CURRENT_COMMIT"

# Cek apakah ada perubahan lokal yang belum di-commit
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Ada perubahan lokal yang belum di-commit:"
  git status --short
  read -r -p "Lanjutkan dan stash perubahan ini? [y/N] " yn
  if [[ ! "$yn" =~ ^[Yy]$ ]]; then
    err "Dibatalkan oleh user."
    exit 1
  fi
  git stash push -u -m "auto-stash before update $(date +%F-%H%M)"
  ok "Perubahan lokal di-stash"
fi

# ---- 1. Pull kode terbaru ----
log "Pull kode terbaru dari git..."
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
git fetch --all --prune
git pull --ff-only origin "$BRANCH"
NEW_COMMIT=$(git rev-parse --short HEAD)

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
  ok "Sudah versi terbaru ($NEW_COMMIT) — tidak ada perubahan kode"
else
  ok "Updated: $CURRENT_COMMIT → $NEW_COMMIT"
  echo ""
  echo "Perubahan:"
  git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT" | head -20
  echo ""
fi

# ---- 2. Build frontend ----
if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
  log "Build frontend..."
  cd "$APP_DIR"

  if command -v bun >/dev/null 2>&1; then
    PKG="bun"
    bun install --frozen-lockfile || bun install
    bun run build
  elif command -v npm >/dev/null 2>&1; then
    PKG="npm"
    npm ci || npm install
    npm run build
  else
    err "bun/npm tidak ditemukan. Install dulu."
    exit 1
  fi
  ok "Frontend build selesai (pakai $PKG)"
else
  warn "SKIP_FRONTEND=1 — build frontend dilewati"
fi

# ---- 3. Update backend ----
if [ "${SKIP_BACKEND:-0}" != "1" ]; then
  if [ ! -d "$BACKEND_DIR" ]; then
    err "Backend dir tidak ditemukan: $BACKEND_DIR"
    exit 1
  fi
  log "Update backend dependencies..."
  cd "$BACKEND_DIR"

  if [ ! -f .env ]; then
    err ".env tidak ada di $BACKEND_DIR"
    err "Copy dari .env.example dan isi DATABASE_URL, JWT_SECRET, dll."
    exit 1
  fi

  npm install --omit=dev
  ok "Backend dependencies updated"

  # ---- 4. Migrasi DB ----
  if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
    log "Jalankan database migrations..."
    npm run db:migrate
    ok "Migrations selesai"
  else
    warn "SKIP_MIGRATE=1 — db:migrate dilewati"
  fi
else
  warn "SKIP_BACKEND=1 — update backend dilewati"
fi

# ---- 5. Restart PM2 ----
log "Restart aplikasi via PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  err "pm2 tidak terinstall. Install: npm i -g pm2"
  exit 1
fi

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
  ok "PM2 process '$PM2_NAME' di-reload (zero-downtime)"
else
  warn "PM2 process '$PM2_NAME' belum ada — start baru..."
  cd "$BACKEND_DIR"
  pm2 start src/server.js --name "$PM2_NAME" --update-env
  pm2 save
  ok "PM2 process '$PM2_NAME' dimulai"
fi

# ---- 6. Reload Nginx (kalau ada) ----
if command -v nginx >/dev/null 2>&1; then
  log "Test & reload Nginx config..."
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    ok "Nginx reloaded"
  else
    warn "Nginx config invalid — skip reload. Jalankan 'sudo nginx -t' untuk debug."
  fi
else
  warn "Nginx tidak terdeteksi — skip reload"
fi

# ---- 7. Health check ----
log "Health check..."
sleep 2
APP_PORT="${APP_PORT:-3000}"
if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
  ok "Backend merespons di port $APP_PORT"
elif curl -fsS "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1; then
  ok "Backend merespons di port $APP_PORT (no /api/health route)"
else
  warn "Backend belum merespons di port $APP_PORT — cek log: pm2 logs $PM2_NAME"
fi

# ---- selesai ----
echo ""
ok "═══════════════════════════════════════════════════"
ok " UPDATE SELESAI"
ok "═══════════════════════════════════════════════════"
echo ""
echo "  Versi sekarang : $NEW_COMMIT"
echo "  PM2 status     : pm2 status"
echo "  Live log       : pm2 logs $PM2_NAME"
echo "  Rollback       : git reset --hard $CURRENT_COMMIT && bash vps-standalone/update.sh"
echo ""
