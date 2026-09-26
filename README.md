# 🤖 Geotama Telegram Backend v2.0

Backend Next.js untuk Vercel dengan fitur lengkap: admin dashboard, message history, frontend tracker, templates, rate limiting, dan activity logging.

---

## ✨ Fitur Baru v2.0

| Fitur | Deskripsi |
|---|---|
| 🖥️ **Admin Dashboard** | UI web profesional dengan login, stats, tabel, modal |
| 📊 **Dashboard Stats** | Total bot, pesan hari ini, errors, tracker events |
| 💬 **Message History** | Riwayat semua pesan + fitur resend |
| 📋 **Message Templates** | Template dengan variabel `{{nama}}`, reusable |
| 📦 **Bulk Send** | Kirim 1 pesan ke banyak chat ID (maks 50) |
| 📡 **Web Tracker** | Rekam aktivitas website (klik, form, error) → notif Telegram |
| 🔐 **Sensitive Masking** | Password, token, key otomatis dimasking jadi `***` |
| ⚡ **Rate Limiting** | Maks N pesan/menit per bot (configurable) |
| 🧪 **Bot Test** | Verifikasi token bot valid via Telegram API |
| 📝 **Activity Logs** | Semua request tercatat, bisa difilter & dibersihkan |
| 🔄 **API Key Rotate** | Ganti API key bot kapan saja |
| 🔑 **Rotate + Log** | Setiap rotate tercatat + notif Telegram admin |
| 🧪 **API Playground** | Test send/bulk/template langsung dari dashboard |

---

## 🚀 Setup Cepat

### 1. Deploy ke Vercel
```bash
git push origin main
# Vercel auto-deploy dari repo
```

### 2. Set Environment Variables
```env
DATABASE_URL=postgresql://...      # Neon PostgreSQL
MASTER_API_KEY=secret-panjang      # Untuk akses admin
ENCRYPTION_KEY=64hex-dari-openssl  # Generate: openssl rand -hex 32
ALLOWED_ORIGINS=*                  # Atau domain spesifik
NOTIFY_BOT_TOKEN=                  # Opsional: bot token untuk notif admin
NOTIFY_CHAT_ID=                    # Opsional: chat ID penerima notif
```

### 3. Init Database
```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/admin/bots/init \
  -H "x-admin-key: MASTER_API_KEY"
```

### 4. Buat Bot Pertama
```bash
curl -X POST https://YOUR-DOMAIN.vercel.app/api/admin/bots \
  -H "x-admin-key: MASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"MyBot","botToken":"123:ABC...","chatId":"-100xxx","rateLimit":60}'
```
> ⚠️ Simpan `apiKey` dari response — hanya muncul sekali!

### 5. Akses Dashboard
Buka `https://YOUR-DOMAIN.vercel.app` → masukkan `MASTER_API_KEY`

---

## 📡 API Endpoints

### Public (pakai `x-api-key`)
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/telegram/send` | Kirim pesan tunggal |
| `POST` | `/api/telegram/bulk` | Kirim ke banyak chat |
| `POST` | `/api/tracker` | Terima event frontend tracker |
| `GET` | `/api/health` | Status server + DB |

### Admin (pakai `x-admin-key`)
| Method | Path | Deskripsi |
|---|---|---|
| `GET/POST` | `/api/admin/bots` | List / buat bot |
| `PATCH/DELETE` | `/api/admin/bots/:id` | Edit / hapus bot |
| `POST` | `/api/admin/bots/:id/test` | Test koneksi bot |
| `POST` | `/api/admin/bots/:id/rotate-key` | Ganti API key |
| `POST` | `/api/admin/bots/init` | Init database |
| `GET` | `/api/admin/stats` | Statistik dashboard |
| `GET` | `/api/admin/messages` | Riwayat pesan |
| `POST` | `/api/admin/messages/:id/resend` | Kirim ulang pesan |
| `GET/POST` | `/api/admin/templates` | Template pesan |
| `PATCH/DELETE` | `/api/admin/templates/:id` | Edit / hapus template |
| `GET/POST` | `/api/admin/tracker` | Kelola tracker configs |
| `GET` | `/api/admin/tracker/events` | List tracker events |
| `GET/DELETE` | `/api/admin/logs` | Activity logs |

---

## 💡 Contoh Penggunaan

### Kirim Pesan (Flexible Fields)
```js
// message / text / msg  →  semua valid
// chatId / chat_id / to  →  semua valid
fetch('/api/telegram/send', {
  method: 'POST',
  headers: { 'x-api-key': 'gt_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Halo!',         // atau "message" atau "msg"
    to: '-100123',         // atau "chatId" atau "chat_id"
    parse_mode: 'HTML'     // atau "parseMode" atau "mode"
  })
});
```

### Kirim via Template
```js
fetch('/api/telegram/send', {
  method: 'POST',
  headers: { 'x-api-key': 'gt_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template: 'notif_order',       // nama template
    vars: { nama: 'Budi', total: '50000' }
  })
});
```

### Bulk Send
```js
fetch('/api/telegram/bulk', {
  method: 'POST',
  headers: { 'x-api-key': 'gt_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Broadcast ke semua!',
    chatIds: ['-100111', '-100222', '-100333']
  })
});
```

### Frontend Tracker (auto-tracking)
```html
<!-- Pasang di <head> website InfinityFree kamu -->
<script>
(function(w,d){
  var E='https://YOUR.vercel.app/api/tracker',K='tracker_key_kamu';
  var SID='gt_'+Math.random().toString(36).slice(2,9);
  var MSK=['password','token','secret','key','card','cvv','pin'];
  function mask(o){var r={};for(var k in o){r[k]=MSK.some(function(m){return k.toLowerCase().indexOf(m)>-1})?'***':o[k];}return r;}
  function send(ev,data){
    var p=JSON.stringify({event:ev,url:w.location.href,referrer:d.referrer,session_id:SID,data:mask(data||{})});
    var b=new Blob([p],{type:'application/json'});
    (w.navigator.sendBeacon&&w.navigator.sendBeacon(E+'?k='+K,b))||fetch(E,{method:'POST',headers:{'Content-Type':'application/json','x-tracker-key':K},body:p}).catch(function(){});
  }
  send('page_view',{title:d.title});
  d.addEventListener('submit',function(e){var f=e.target,fd={};[].forEach.call(f.elements,function(el){if(el.name&&el.type!=='submit')fd[el.name]=el.value;});send('form_submit',{fields:mask(fd)});},true);
  d.addEventListener('click',function(e){var el=e.target.closest('button,a');if(!el)return;send('click',{text:(el.innerText||'').slice(0,50),href:el.href||null});},true);
  w.addEventListener('error',function(e){send('js_error',{message:e.message,file:e.filename});});
  w.GeoTracker={track:send};
})(window,document);
</script>
```
> Password & data sensitif otomatis dimasking sebelum dikirim ke server maupun Telegram.

---

## 🔐 Keamanan

- Bot token dienkripsi AES-256-GCM di database
- API key di-hash SHA-256 (tidak disimpan plaintext)
- Rate limiting per bot (configurable)
- Sensitive field masking di tracker (password → ***)
- CORS configurable via `ALLOWED_ORIGINS`
- Timing-safe comparison untuk auth

---

## 🗄️ Database Tables

| Tabel | Fungsi |
|---|---|
| `telegram_bots` | Registry bot + encrypted token |
| `message_logs` | Riwayat semua pesan terkirim |
| `message_templates` | Template pesan reusable |
| `activity_logs` | Audit trail semua request |
| `tracker_configs` | Konfigurasi frontend tracker |
| `tracker_events` | Event dari website frontend |
