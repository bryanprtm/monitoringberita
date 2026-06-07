# Update VPS yang Sudah Pakai Supabase → PostgreSQL Standalone

Skenario: VPS Anda **sudah online** pakai versi lama (Supabase
cloud/self-hosted). Sekarang mau migrasi ke backend standalone baru
(PostgreSQL + Node.js) **tanpa kehilangan data dan tanpa downtime lama**.

> Kalau VPS masih kosong, pakai `MIGRATION.md` (fresh install). Dokumen ini
> khusus untuk VPS yang **sudah ada datanya**.

---

## Ringkasan Alur

```text
[VPS Lama: Supabase] ──(1) backup data──┐
                                        ▼
                              [Export users.csv + data.sql]
                                        │
        (2) install backend baru ──────►│
        di folder berbeda               ▼
                              [PostgreSQL baru + Node.js]
                                        │
        (3) import data ───────────────►│
        (4) build frontend baru        │
        (5) switch Nginx ──────────────►│
        (6) verifikasi, lalu hapus lama
```

Estimasi downtime: **5–10 menit** (hanya saat switch Nginx).

---

## Langkah 0 — SSH ke VPS & Backup Penuh DULU

**Wajib.** Jangan skip — kalau gagal Anda bisa rollback.

```bash
ssh user@<vps-ip>
sudo mkdir -p /var/backups/migrasi && sudo chown $USER /var/backups/migrasi
cd /var/backups/migrasi

# Snapshot full sistem (opsional tapi sangat dianjurkan via panel VPS)
# Hetzner/DigitalOcean/Vultr: klik "Snapshot" di dashboard sekarang.
```

---

## Langkah 1 — Identifikasi Mode Supabase Anda

Cek pakai yang mana:

```bash
# A) Kalau pakai Supabase CLOUD (online di supabase.com)
cat ~/news-command-center/.env | grep VITE_SUPABASE_URL
# Hasil: https://xxxxx.supabase.co  → CLOUD

# B) Kalau pakai Supabase self-hosted (Docker di VPS sendiri)
docker ps | grep supabase
# Ada container 'supabase-db', 'supabase-auth', dll → SELF-HOSTED
```

---

## Langkah 2 — Export Data dari Supabase Lama

### Jika Supabase CLOUD

Ambil connection string dari **Supabase Dashboard → Settings → Database**:

```bash
export OLD_DB='postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres'
```

### Jika Supabase SELF-HOSTED di VPS yang sama

```bash
# Password ada di .env Supabase
export OLD_DB='postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres'
# Atau langsung dari dalam container:
# docker exec -t supabase-db pg_dump -U postgres ...
```

### Export users + data (sama untuk kedua mode):

```bash
cd /var/backups/migrasi

# 1. Daftar user (id + email)
psql "$OLD_DB" -c "\copy (SELECT id, email FROM auth.users) TO 'users.csv' CSV HEADER"

# 2. Data tabel aplikasi
pg_dump "$OLD_DB" \
  --data-only --schema=public \
  --table=public.rss_sources \
  --table=public.youtube_sources \
  --table=public.profiles \
  --column-inserts \
  -f supabase-data.sql

ls -lh users.csv supabase-data.sql
```

✅ Sekarang Anda punya 2 file backup. **Aman.**

---

## Langkah 3 — Install Backend Standalone Baru (Paralel, Belum Live)

Install ke **folder & port berbeda** supaya tidak ganggu yang lama:

```bash
cd ~
git pull   # tarik kode terbaru yang ada folder vps-standalone/
#   ATAU kalau belum di-clone:
# git clone <repo-url> ~/news-command-center-new

cd ~/news-command-center/vps-standalone

# Install TANPA Nginx & TANPA domain dulu (biar tidak bentrok dengan yang lama)
APP_PORT=3001 DOMAIN= bash install.sh
```

Penjelasan flag:
- `APP_PORT=3001` → backend baru jalan di port 3001 (lama tetap di 80/3000)
- `DOMAIN=` (kosong) → install skip konfigurasi Nginx supaya domain lama tetap melayani user

Setelah selesai, tes lokal di VPS:

```bash
curl http://127.0.0.1:3001/api/auth/me
# Harus jawab 401 Unauthorized → artinya backend hidup ✅
```

---

## Langkah 4 — Import Data Backup ke Database Baru

```bash
cd ~/news-command-center/vps-standalone
node scripts/import-from-supabase.js \
  /var/backups/migrasi/users.csv \
  /var/backups/migrasi/supabase-data.sql
```

Verifikasi:

```bash
source .env
psql "$DATABASE_URL" -c "SELECT count(*) AS users FROM users;"
psql "$DATABASE_URL" -c "SELECT count(*) AS rss FROM rss_sources;"
psql "$DATABASE_URL" -c "SELECT count(*) AS yt  FROM youtube_sources;"
```

Jumlah harus sama dengan di Supabase lama.

---

## Langkah 5 — Build Frontend Versi Baru

Pastikan kode frontend sudah diubah dari `@supabase/supabase-js` ke
`fetch('/api/...')` + WebSocket (lihat `MIGRATION.md` Langkah 8).

```bash
cd ~/news-command-center
bun install && bun run build
# Hasil ada di ~/news-command-center/dist
```

Backend baru otomatis serve dari folder ini (`FRONTEND_DIST` di `.env`).

---

## Langkah 6 — Switch Nginx ke Backend Baru (Downtime ~30 detik)

Backup config Nginx lama dulu:

```bash
sudo cp /etc/nginx/sites-available/news-cc /etc/nginx/sites-available/news-cc.OLD 2>/dev/null || true
```

Update upstream port dari `3000` (lama) → `3001` (baru):

```bash
sudo sed -i 's/127.0.0.1:3000/127.0.0.1:3001/g' /etc/nginx/sites-available/news-cc
sudo nginx -t && sudo systemctl reload nginx
```

Buka browser → coba login dengan password sementara `changeme123`.

---

## Langkah 7 — Beri Tahu Semua User

Broadcast (WA grup, email):

> "Sistem kami sudah pindah ke server baru. Silakan login menggunakan
> password sementara: **`changeme123`** lalu segera ganti password Anda
> di menu Profil."

---

## Langkah 8 — Monitor 24 Jam, Lalu Cleanup

Setelah yakin semua jalan normal selama **minimal 24 jam**:

### Jika Supabase CLOUD:

- Buka Supabase Dashboard → Project Settings → **Pause project**
- Setelah 1 minggu lagi tidak ada masalah → **Delete project**

### Jika Supabase SELF-HOSTED (Docker di VPS sama):

```bash
# Cari folder Supabase lama
cd ~/supabase   # atau lokasi docker-compose.yml Supabase Anda
docker compose down

# Hapus volume (HATI-HATI — pastikan backup sudah aman!)
docker volume ls | grep supabase
# docker volume rm <volume-name>

# Hapus folder
# rm -rf ~/supabase
```

Free up disk + RAM untuk backend baru.

---

## Rollback Cepat (Jika Ada Masalah)

```bash
# 1. Kembalikan Nginx ke backend lama
sudo cp /etc/nginx/sites-available/news-cc.OLD /etc/nginx/sites-available/news-cc
sudo systemctl reload nginx

# 2. Stop backend baru
pm2 stop news-cc
```

Data di Supabase lama **tidak disentuh** selama proses migrasi → aman 100%
untuk rollback kapanpun (sebelum Langkah 8).

---

## Troubleshooting Update

| Gejala | Solusi |
|---|---|
| Port 3001 sudah dipakai | Ganti `APP_PORT=3002` di Langkah 3, sesuaikan Nginx |
| `pg_dump: aborting because of server version mismatch` | Install `postgresql-client-16` di VPS: `sudo apt install postgresql-client-16` |
| Data ada tapi user tidak bisa login | Pastikan `users.csv` di-import sebelum `supabase-data.sql` (script sudah lakukan otomatis) |
| Realtime tidak update | Cek Nginx block `/api/ws` ada `proxy_set_header Upgrade` |
| Frontend masih panggil supabase.co | Browser cache — hard refresh (Ctrl+Shift+R) atau cek `dist/` ter-build dari source terbaru |

---

## Update Berkala Setelah Migrasi (Pull Code Baru dari Repo)

Untuk update aplikasi normal setelah pindah ke standalone:

```bash
cd ~/news-command-center
git pull

# Rebuild frontend
bun install && bun run build

# Update backend deps + jalankan migrasi baru (kalau ada)
cd vps-standalone
npm install
npm run db:migrate
pm2 restart news-cc
```

Selesai — zero downtime untuk update biasa.