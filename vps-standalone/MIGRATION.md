# Migrasi dari Supabase ke PostgreSQL Self-Hosted

Tutorial lengkap memindahkan data + auth dari Supabase Cloud ke backend
standalone ini.

## Ringkasan

| Bagian | Asal (Supabase) | Tujuan (VPS) |
|---|---|---|
| Schema tabel | `public.*` di Supabase | `public.*` di PostgreSQL VPS (sudah dibuat `migrations/001_init.sql`) |
| Data tabel | `profiles`, `rss_sources`, `youtube_sources` | tabel yang sama |
| User account | `auth.users` (managed Supabase) | tabel `users` (bcrypt hash) |
| Password | Hash format Supabase (Argon2/scrypt) | bcrypt — **TIDAK BISA diimport** → user wajib reset |
| Realtime | Supabase Realtime channels | `LISTEN/NOTIFY` → WebSocket |

> **Password user lama tidak bisa dipindah** karena Supabase pakai hash
> berbeda. Solusi: import semua user dengan password sementara
> `changeme123`, lalu paksa reset password saat login pertama (atau
> kirim email reset).

---

## Langkah 1 — Siapkan VPS

Server fresh Ubuntu 22.04 / 24.04. Clone repo + jalankan installer:

```bash
git clone <repo-url> ~/news-command-center
cd ~/news-command-center/vps-standalone
DOMAIN=monitoring.example.com bash install.sh
```

Selesai — Anda punya stack kosong (admin/admin123). Sekarang isi data.

---

## Langkah 2 — Ambil kredensial Supabase

Buka **Supabase Dashboard → Project Settings → Database**, salin:
- Host: `db.<project-ref>.supabase.co`
- Port: `5432`
- User: `postgres`
- Password: (klik *Reveal* atau reset)
- Database: `postgres`

Format URL koneksi:

```
postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres
```

Set di shell:

```bash
export SUPA_URL='postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres'
```

Tes:

```bash
psql "$SUPA_URL" -c "SELECT count(*) FROM auth.users;"
```

---

## Langkah 3 — Export data tabel publik

Dari **mesin lokal Anda** (yang punya akses ke kedua DB), atau dari VPS:

```bash
# Hanya data (tanpa schema), tabel yang relevan
pg_dump "$SUPA_URL" \
  --data-only \
  --schema=public \
  --table=public.rss_sources \
  --table=public.youtube_sources \
  --table=public.profiles \
  --column-inserts \
  -f supabase-data.sql
```

Catatan:
- `--data-only` → schema sudah ada di VPS (dari `001_init.sql`).
- `--column-inserts` → format `INSERT ... (col1, col2) VALUES (...)`, aman
  walau urutan kolom beda.
- `profiles` di-import setelah `users` (urutan akan dijaga script).

---

## Langkah 4 — Export user dari `auth.users`

`auth.users` adalah skema khusus Supabase. Yang kita butuh: `id` + `email`.

```bash
psql "$SUPA_URL" -c "\copy (SELECT id, email FROM auth.users) TO 'users.csv' CSV HEADER"
```

File `users.csv` akan berisi semua user_id (UUID) + email mereka.

---

## Langkah 5 — Upload kedua file ke VPS

```bash
scp users.csv supabase-data.sql user@<vps-ip>:~/news-command-center/vps-standalone/
```

---

## Langkah 6 — Import ke PostgreSQL VPS

Di VPS:

```bash
cd ~/news-command-center/vps-standalone
node scripts/import-from-supabase.js users.csv supabase-data.sql
```

Script melakukan:
1. Baca `users.csv`, INSERT semua user ke tabel `users` (password = bcrypt
   dari `"changeme123"`).
2. Jalankan `psql -f supabase-data.sql` → restore `profiles`, `rss_sources`,
   `youtube_sources`.

Verifikasi:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM rss_sources;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM youtube_sources;"
```

---

## Langkah 7 — Beri tahu user untuk reset password

Kirim broadcast email/WA:

> "Sistem dimigrasi ke server baru. Login pakai password sementara
> `changeme123` lalu segera ganti password di menu Profil."

Atau, kalau Anda mau lebih halus: tambahkan flag `must_reset_password` di
tabel `users` dan paksa redirect ke halaman reset setelah login.

---

## Langkah 8 — Update frontend untuk pakai backend baru

Frontend yang sekarang pakai `@supabase/supabase-js` harus diganti pakai
`fetch()` ke endpoint `/api/*`. Contoh perubahan minimal:

### Auth (`src/hooks/useAuth.tsx`)

Ganti `supabase.auth.signInWithPassword(...)` jadi:

```ts
await fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username, password }),
});
```

Idem untuk `signUp` (`/api/auth/signup`), `signOut` (`/api/auth/signout`),
`getCurrentUser` (`/api/auth/me`). Hapus `onAuthStateChange`.

### Data hooks (`src/hooks/useFeedSources.ts`, `useYoutubeSources.ts`)

Ganti `supabase.from('rss_sources').select(...)` jadi:

```ts
const res = await fetch('/api/rss-sources', { credentials: 'include' });
const rows = await res.json();
```

Tabel mapping endpoint:

| Sebelumnya | Sekarang |
|---|---|
| `supabase.from('rss_sources').select()` | `GET /api/rss-sources` |
| `supabase.from('rss_sources').insert(...)` | `POST /api/rss-sources` |
| `supabase.from('rss_sources').delete().eq('id',x)` | `DELETE /api/rss-sources/:id` |
| `supabase.from('youtube_sources').*` | `GET/POST/PATCH/DELETE /api/youtube-sources` |

### Realtime

Ganti `supabase.channel(...).on('postgres_changes', ...)` jadi WebSocket:

```ts
const ws = new WebSocket(`${location.origin.replace('http','ws')}/api/ws`);
ws.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  if (evt.table === 'rss_sources') queryClient.invalidateQueries({ queryKey: ['rss-sources'] });
  if (evt.table === 'youtube_sources') queryClient.invalidateQueries({ queryKey: ['youtube-sources'] });
};
```

Lalu **rebuild frontend** (`bun run build` di root project) — backend
otomatis serve dari `FRONTEND_DIST` (`$APP_DIR/dist`).

---

## Langkah 9 — Matikan Supabase (opsional)

Setelah verifikasi semua fitur jalan di VPS selama ~1 minggu, pause project
Supabase di Dashboard. Hapus kalau sudah yakin.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `duplicate key on profiles_pkey` saat import data | `profiles.id` di Supabase != ada di `users` VPS | Import `users.csv` dulu sebelum `supabase-data.sql` (script sudah melakukannya) |
| `relation auth.users does not exist` | Schema `auth` Supabase tidak ada di VPS | Normal — `users.csv` mengisi tabel `public.users` di VPS, bukan `auth.users` |
| WebSocket tidak nyambung | Nginx tidak forward Upgrade header | Pastikan blok `location /api/ws` di Nginx ada `proxy_set_header Upgrade $http_upgrade` |
| Password `changeme123` ditolak | bcrypt hash beda env | Re-run `node scripts/import-from-supabase.js` (hash di-generate fresh) |
| Cookie tidak ke-set di browser | Domain beda / HTTP | Set `COOKIE_DOMAIN` di `.env`, pastikan HTTPS aktif di produksi |

---

## Rollback

Kalau ada masalah, frontend lama yang masih pakai Supabase tetap bisa
diaktifkan kembali — Supabase project belum dihapus. Cukup:

1. Stop PM2: `pm2 stop news-cc`
2. Build frontend versi Supabase (sebelum diubah)
3. Redeploy

Semua data di Supabase tetap utuh (tidak dihapus selama proses migrasi).

---

## Backup otomatis

```bash
sudo mkdir -p /var/backups/news_cc && sudo chown $USER /var/backups/news_cc
crontab -e
# tambahkan:
0 3 * * * pg_dump -U news_cc news_cc | gzip > /var/backups/news_cc/$(date +\%F).sql.gz && find /var/backups/news_cc -mtime +14 -delete
```

Backup harian, simpan 14 hari, otomatis delete file lama.