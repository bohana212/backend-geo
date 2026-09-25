# Geotama Telegram Backend

Backend Next.js untuk Vercel. Frontend di InfinityFree bisa memanggil backend ini.

## Fitur
- Tambah / list / edit / hapus bot.
- Bot Token disimpan terenkripsi AES-256-GCM.
- Setiap bot punya API key sendiri.
- API key bisa di-rotate.
- Endpoint kirim pesan Telegram.
- CORS.
- PostgreSQL Neon untuk storage permanen.

## Environment Vercel
- DATABASE_URL
- MASTER_API_KEY
- ENCRYPTION_KEY
- ALLOWED_ORIGINS

Generate ENCRYPTION_KEY:
`openssl rand -hex 32`

## Urutan pertama
1. Deploy ke Vercel.
2. Set env variables.
3. POST `/api/admin/bots/init` dengan header `x-admin-key: MASTER_API_KEY`.
4. POST `/api/admin/bots` untuk membuat bot.

## Create
POST `/api/admin/bots`
Header: `x-admin-key: MASTER_API_KEY`

JSON:
`{"name":"Geotama","botToken":"BOT_TOKEN","chatId":"CHAT_ID"}`

API key hanya ditampilkan saat create/rotate.

## Send
POST `/api/telegram/send`
Header: `x-api-key: API_KEY_BOT`

JSON:
`{"message":"Halo dari Geotama!"}`

Optional `chatId` bisa dikirim untuk override chat ID tersimpan.

## Frontend InfinityFree
Contoh browser/PHP:
POST ke:
`https://DOMAIN-VERCEL.vercel.app/api/telegram/send`

Header:
`x-api-key: API_KEY_BOT`

Untuk keamanan, lebih baik API key disimpan di PHP server-side InfinityFree, bukan JavaScript browser.

## Admin
- GET `/api/admin/bots`
- POST `/api/admin/bots`
- PATCH `/api/admin/bots/:id`
- DELETE `/api/admin/bots/:id`
- POST `/api/admin/bots/:id/rotate-key`

Semua admin endpoint memakai `x-admin-key`.
