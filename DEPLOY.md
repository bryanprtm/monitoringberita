# Deploy NEWS COMMAND CENTER ke Ubuntu Server

## 1. Persiapan
- Ubuntu Server 22.04 / 24.04
- User dengan akses `sudo`
- Domain (opsional, untuk Nginx + SSL)

## 2. Jalankan installer

```bash
# salin script ke server
scp install.sh user@server-ip:~/
ssh user@server-ip

# (opsional) export config sebelum menjalankan
export GIT_REPO="https://github.com/USERNAME/REPO.git"
export DOMAIN="monitoring.example.com"
export VITE_SUPABASE_PUBLISHABLE_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"
# kalau mau pakai Postgres lokal (bukan Lovable Cloud):
# export INSTALL_POSTGRES=1

chmod +x install.sh
./install.sh
```

Script akan menginstall:
- Node.js 20, Bun, Git, build-essential
- Nginx + UFW firewall
- PM2 (process manager, auto-start saat boot)
- (Opsional) PostgreSQL 16 + apply semua migration di `supabase/migrations/`
- Build project dan jalankan di port `3000`

## 3. Database

Project ini default-nya pakai **Lovable Cloud (Supabase)**. Cukup isi
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, dan
`SUPABASE_SERVICE_ROLE_KEY` di environment sebelum menjalankan script.

Kalau mau **self-host PostgreSQL**, set `INSTALL_POSTGRES=1`. Script akan:
- Install PostgreSQL 16
- Buat database `news_cc` + user `news_cc`
- Apply semua file `.sql` di `supabase/migrations/` secara berurutan

## 4. Upload ke GitHub

Cara termudah lewat integrasi Lovable:

1. Di editor Lovable, klik menu **+** (pojok kiri bawah) → **GitHub** → **Connect project**
2. Authorize Lovable GitHub App
3. Klik **Create Repository** — Lovable akan auto-push semua kode (termasuk `install.sh` & `DEPLOY.md`)

Atau manual dari komputer lokal:

```bash
git init
git remote add origin https://github.com/USERNAME/REPO.git
git add .
git commit -m "Initial commit: news command center"
git branch -M main
git push -u origin main
```

## 5. Operasional

```bash
pm2 status                    # cek status
pm2 logs news-command-center  # lihat log
pm2 restart news-command-center
```

HTTPS (setelah DNS domain mengarah ke server):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d monitoring.example.com
```
