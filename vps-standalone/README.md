# News CC — VPS Standalone Backend

Backend Node.js (Fastify + PostgreSQL + JWT + WebSocket) untuk menggantikan
Supabase. Berjalan 100% di VPS Anda — tidak ada layanan eksternal.

## Stack

| Layer | Implementasi |
|---|---|
| HTTP | Fastify 4 |
| Database | PostgreSQL 16 (pg pool) |
| Auth | bcrypt + JWT (jose) di httpOnly cookie |
| Realtime | PostgreSQL `LISTEN/NOTIFY` → WebSocket (`@fastify/websocket`) |
| Validasi | Zod |

## Endpoints

```
POST   /api/auth/signup          { username, password, displayName? }
POST   /api/auth/signin          { username, password }
POST   /api/auth/signout
GET    /api/auth/me              (auth)

GET    /api/rss-sources
POST   /api/rss-sources          (auth)
DELETE /api/rss-sources/:id      (auth, owner/admin)

GET    /api/youtube-sources
POST   /api/youtube-sources      (auth)
PATCH  /api/youtube-sources/:id  (auth)
DELETE /api/youtube-sources/:id  (auth)

GET    /api/health
GET    /api/ws                   (WebSocket realtime)
```

## Quick start (lokal)

```bash
cd vps-standalone
cp .env.example .env
# edit DATABASE_URL & JWT_SECRET
npm install
npm run db:migrate
npm run db:seed       # bikin admin/admin123 + 3 RSS default
npm run dev
```

## Deploy ke VPS

```bash
# di server fresh Ubuntu
git clone <repo> ~/news-command-center
cd ~/news-command-center/vps-standalone
DOMAIN=monitoring.example.com bash install.sh
```

`install.sh` akan: install Node 20 + PostgreSQL 16 + Nginx + PM2, buat DB,
isi `.env`, jalankan migrasi & seed, build frontend, start PM2, setup Nginx
reverse proxy (termasuk upgrade WebSocket di `/api/ws`).

## Migrasi dari Supabase

Lihat **[MIGRATION.md](./MIGRATION.md)**.

## Backup harian

```bash
sudo crontab -e
# tambahkan:
0 3 * * * pg_dump -U news_cc news_cc | gzip > /var/backups/news_cc_$(date +\%F).sql.gz
```