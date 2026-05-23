## Tujuan

Mengganti Lovable Cloud (Supabase) dengan stack self-hosted penuh agar deployment ke VPS hanya butuh `install.sh` + `git clone` + `npm start`, tanpa dependency ke layanan eksternal.

## Stack baru

| Layer | Sekarang | Setelah migrasi |
|---|---|---|
| Database | Supabase Postgres (cloud) | PostgreSQL 16 (self-hosted di VPS) |
| Auth | Supabase Auth (`signInWithPassword`) | Email + bcrypt + JWT (httpOnly cookie) |
| Realtime | Supabase Realtime channels | WebSocket native (`ws` package) di TanStack |
| Query layer | `@/integrations/supabase/client` | `pg` (node-postgres) + Drizzle ORM |
| File storage | — | (tidak dibutuhkan) |

## Peringatan penting

**Setelah migrasi, app TIDAK lagi bisa dijalankan di preview Lovable** karena Lovable preview environment tidak punya PostgreSQL lokal. App hanya akan jalan saat di-deploy ke VPS (atau saat dev lokal via Docker). Jika Anda masih ingin iterasi visual di Lovable, sebaiknya:
- **Opsi A**: Tetap pakai Lovable Cloud untuk dev di Lovable, lalu deploy ke VPS pakai Lovable Cloud yang sama (sudah jalan sekarang).
- **Opsi B**: Migrasi penuh seperti plan ini — kehilangan preview Lovable, tapi 100% self-hosted.

Plan ini mengasumsikan **Opsi B**.

## Langkah implementasi

### 1. Schema database (Drizzle ORM)
Buat `src/db/schema.ts` dengan tabel:
- `users` (id, email unique, password_hash, display_name, role, created_at)
- `rss_sources` (id, slug, name, category, url, is_default, created_by, created_at)
- `youtube_sources` (id, name, url, category, created_by, created_at, updated_at)

Buat `src/db/client.ts` — koneksi pool `pg` baca `DATABASE_URL` dari `process.env`.

Buat folder `drizzle/migrations/` + script `npm run db:migrate` untuk apply schema saat deployment.

### 2. Auth custom (JWT)
Buat:
- `src/lib/auth.server.ts` — `hashPassword`, `verifyPassword` (bcrypt), `signJWT`, `verifyJWT` (jose).
- `src/lib/auth.functions.ts` — server functions: `signUp`, `signIn`, `signOut`, `getCurrentUser`. JWT disimpan di httpOnly cookie via `setCookie` dari `@tanstack/react-start/server`.
- `src/middleware/requireAuth.ts` — pengganti `requireSupabaseAuth`, baca cookie + verify JWT, inject `userId` + `role` ke context.

### 3. Ganti pemakaian Supabase
- `src/hooks/useAuth.tsx` → panggil server functions `signIn`/`signOut`/`getCurrentUser` (via `useServerFn` + React Query), hapus `supabase.auth.*` dan `onAuthStateChange`.
- `src/hooks/useFeedSources.ts`, `useYoutubeSources.ts` → ganti `supabase.from(...)` jadi server functions Drizzle (`listFeedSources`, `addFeedSource`, `deleteFeedSource`, dst).
- `src/routes/login.tsx` → tetap pakai `useAuth`, no logic change.
- Hapus folder `src/integrations/supabase/` dan `supabase/` (config.toml, migrations) setelah migrasi.

### 4. Realtime via WebSocket
- Server route `src/routes/api/ws.ts` — handler WebSocket upgrade (`ws` package), broadcast event saat ada insert/delete di `rss_sources` / `youtube_sources`.
- Client hook `src/hooks/useRealtimeSources.ts` — `new WebSocket('/api/ws')`, subscribe, invalidate React Query saat dapat event.
- Setiap mutation server function emit event ke WS hub.

**Catatan**: Cloudflare Worker (runtime preview Lovable) tidak support `ws` package native; jadi WebSocket hanya jalan di VPS (Node.js runtime via `node-server` adapter TanStack Start).

### 5. Build & deployment
Update `install.sh`:
```bash
# Install PostgreSQL 16
sudo apt install postgresql-16
sudo -u postgres createdb monitoring_berita
sudo -u postgres psql -c "CREATE USER app WITH PASSWORD '...'; GRANT ALL ON DATABASE monitoring_berita TO app;"

# Setup env
cat > .env <<EOF
DATABASE_URL=postgresql://app:...@localhost:5432/monitoring_berita
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
EOF

# Install deps, run migrations, build
npm ci
npm run db:migrate
npm run build

# PM2 + Nginx reverse proxy
npm i -g pm2
pm2 start npm --name monitoring-berita -- start
pm2 save && pm2 startup
```

Update `DEPLOY.md` dengan instruksi PostgreSQL, JWT secret, Nginx config (proxy `/api/ws` untuk WebSocket upgrade), SSL via certbot.

### 6. Adapter Node.js
Update `vite.config.ts` / TanStack config dari Cloudflare Worker → Node.js adapter agar build menghasilkan server Node yang bisa jalan via `node .output/server/index.mjs`.

## Dependencies baru
```
bun add pg drizzle-orm drizzle-kit bcryptjs jose ws
bun add -d @types/pg @types/bcryptjs @types/ws
```

## Dependencies dihapus
Folder `src/integrations/supabase/`, package `@supabase/supabase-js`, folder `supabase/`.

## Hasil akhir
- 1 file `install.sh` → setup VPS Ubuntu fresh jadi production-ready dalam ~5 menit.
- Tidak ada API key eksternal, tidak ada vendor lock-in, semua data di VPS Anda.
- Backup = `pg_dump` cronjob harian.

**Konfirmasi sebelum saya mulai**: Apakah Anda setuju kehilangan kemampuan preview di Lovable demi self-hosted penuh? Atau mau tetap pakai Lovable Cloud (lebih mudah, tetap bisa deploy)?
