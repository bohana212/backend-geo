# GEOTAMA COMPUTER — PHP (InfinityFree) + Backend Telegram Terpusat

Versi PHP dari Geotama Computer, didesain semirip mungkin dengan versi
Next.js sebelumnya, tapi:

- Jalan di hosting PHP biasa (InfinityFree), data disimpan di file JSON
  (`data/*.json`) seperti versi awal — bukan Redis, karena InfinityFree
  punya disk sungguhan yang bisa ditulis.
- Notifikasi Telegram **tidak lagi** menyimpan Bot Token langsung di
  `settings.json`. Semua bot dikelola lewat backend Vercel
  (`geotama-telegram-backend`), dan toko ini hanya menyimpan **API key**
  dari satu bot yang dipilih jadi "bot aktif".

## Syarat hosting

- PHP **8.1 atau lebih baru** (pakai fitur `never` return type & `readonly`-style typing).
  Di panel InfinityFree, atur versi PHP lewat menu **Software → PHP Version**.
- Ekstensi `curl` dan `json` aktif (biasanya aktif secara default).

## Cara pasang

1. Upload seluruh isi folder ini ke `htdocs/`.
2. Salin `config.example.php` → `config.php`, isi:
   - `TG_BACKEND_URL` → URL backend Vercel kamu.
   - `TG_MASTER_API_KEY` → sama persis dengan `MASTER_API_KEY` di Environment
     Variables Vercel backend itu.
   - `SESSION_SALT` → string acak bebas.
3. Pastikan folder `data/` bisa ditulis PHP (permission 755/775 — di
   InfinityFree biasanya sudah otomatis bisa).
4. Buka `https://domainkamu.infinityfreeapp.com/login.php`.
   Kalau `data/users.json` masih yang lama, login pakai akun lama (password
   hash lama tetap kompatibel). Kalau kosong, akun awal otomatis dibuat:
   `superadmin` / `admin123` — **segera ganti password ini setelah login.**

## Fitur baru: Bot Telegram (API Key Manager)

Di halaman **Setting** (khusus **Super Admin**) ada bagian baru "Bot Telegram
(Backend Terpusat)":

- **Tambah Bot Baru** — isi nama, Bot Token (dari @BotFather), Chat ID (dari
  @userinfobot). Bot dibuat di backend Vercel, API key muncul **sekali** dan
  bisa langsung dijadikan **Bot Aktif Toko Ini**.
- **Daftar Bot** — semua bot yang ada di backend (kalau backend dipakai
  banyak toko), dengan status aktif/nonaktif.
- **Edit** — ubah nama / Chat ID / Bot Token bot yang sudah ada.
- **Aktifkan / Nonaktifkan** bot di backend.
- **Rotate Key** — bikin API key baru. Kalau bot itu sedang jadi bot aktif
  toko ini, API key baru otomatis dipakai. Kalau bukan, ada tombol "Jadikan
  Bot Aktif Toko Ini" yang muncul begitu key baru ditampilkan.
- **Hapus** — hapus bot dari backend.
- **Lepas Bot Aktif** — melepas bot dari toko ini tanpa menghapusnya dari
  backend (misalnya untuk pindah ke bot lain).
- **Kirim Pesan Tes** — pakai bot aktif langsung, tidak perlu tempel API key
  manual.

Kenapa "Jadikan Aktif" cuma muncul tepat setelah create/rotate? Karena
backend cuma mengirim API key **sekali** (disimpan dalam bentuk hash di
database, tidak bisa ditampilkan ulang) — sama seperti password. Kalau kamu
mau memakai bot lama yang API key-nya sudah hilang, rotate dulu key-nya.

Semua notifikasi otomatis (order dari katalog, error server, OTP admin
baru) sekarang lewat backend ini, memakai bot aktif toko.

## Keamanan

- `config.php` dan semua file `data/*.json` diblokir dari akses langsung
  lewat browser (lihat `.htaccess`). Tetap jangan commit `config.php` ke
  repo publik.
- Login dibatasi 10 percobaan / 5 menit (per session).
- Semua form dilindungi CSRF token.
- Super admin tidak bisa menurunkan role / menonaktifkan akunnya sendiri.
- `/notify.php` dibatasi 10 request/menit per IP (file-based rate limit)
  supaya tidak dipakai untuk spam ke Telegram kamu.

## Struktur file

```
config.example.php     # Salin jadi config.php
index.php              # Katalog publik
login.php / logout.php
dashboard.php          # Ringkasan & daftar produk
edit.php               # Tambah/edit/hapus produk
setting.php            # Profile toko, kelola admin, Bot Telegram (API key manager)
notify.php             # Dipanggil dari katalog (sendBeacon) tiap klik Tanya/Pesan
includes/
  bootstrap.php        # Session, CSRF, helper dasar
  data.php             # Baca/tulis data/*.json
  auth.php             # Login & role
  utils.php            # Format harga, status stok, dll
  specs.php            # Spesifikasi per kategori produk
  telegram.php         # Semua panggilan ke backend Vercel (curl)
  common.php           # Include semua di atas + exception handler global
  admin_shell_top.php / admin_shell_bottom.php  # Layout admin (navbar dsb)
data/
  products.json, users.json, settings.json
assets/
  catalog.css   # Tampilan katalog publik (sama seperti versi asli)
  admin.css     # Tampilan admin panel (gaya sama seperti versi Next.js)
```
