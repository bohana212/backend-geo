<?php
require_once __DIR__ . '/includes/common.php';

$CURRENT_USER = require_role(['verified_admin', 'super_admin'], 'setting.php');
$isSuper = is_super_admin($CURRENT_USER);
$SETTINGS = get_settings();
$flash = flash_get();
$newApiKey = $_SESSION['new_api_key'] ?? null; // ['name'=>,'id'=>,'chatId'=>,'apiKey'=>]
unset($_SESSION['new_api_key']);

/* =============== POST handlers =============== */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'store') {
        save_settings(array_merge($SETTINGS, [
            'store_name' => str_field('store_name'),
            'address' => str_field('address'),
            'address2' => str_field('address2'),
            'phone' => preg_replace('/\D/', '', str_field('phone')),
            'email' => str_field('email'),
            'contact_admin' => str_field('contact_admin'),
            'bio' => str_field('bio'),
            'profile_image' => str_field('profile_image'),
            'instagram' => str_field('instagram'),
            'facebook' => str_field('facebook'),
            'tiktok' => str_field('tiktok'),
            'whatsapp' => preg_replace('/\D/', '', str_field('whatsapp')),
        ]));
        flash_set('success', 'Profile toko berhasil diperbarui.');
        redirect('setting.php');
    }

    if ($action === 'profile') {
        $password = (string) ($_POST['password'] ?? '');
        if ($password !== '' && strlen($password) < 6) {
            flash_set('error', 'Password baru minimal 6 karakter.');
            redirect('setting.php');
        }
        $users = get_users();
        foreach ($users as $i => $u) {
            if ((int) $u['id'] === (int) $CURRENT_USER['id']) {
                $users[$i]['name'] = str_field('name') ?: $u['name'];
                $users[$i]['email'] = str_field('email');
                if ($password !== '') $users[$i]['password'] = password_hash($password, PASSWORD_BCRYPT);
                break;
            }
        }
        save_users($users);
        flash_set('success', 'Profile akun diperbarui.');
        redirect('setting.php');
    }

    /* ---- Bot Telegram: butuh super_admin ---- */
    if (in_array($action, ['bot_create', 'bot_update', 'bot_delete', 'bot_toggle', 'bot_rotate', 'bot_activate', 'bot_disconnect', 'bot_test'], true)) {
        if (!$isSuper) { flash_set('error', 'Akses ditolak.'); redirect('setting.php'); }

        if ($action === 'bot_create') {
            $name = str_field('name');
            $botToken = str_field('botToken');
            $chatId = str_field('chatId');
            if ($name === '' || $botToken === '' || $chatId === '') {
                flash_set('error', 'Nama, Bot Token, dan Chat ID wajib diisi.');
                redirect('setting.php');
            }
            [$status, $data] = tg_create_bot($name, $botToken, $chatId);
            if ($status === 201 && !empty($data['ok'])) {
                $_SESSION['new_api_key'] = [
                    'id' => $data['bot']['id'] ?? '', 'name' => $data['bot']['name'] ?? $name,
                    'chatId' => $data['bot']['chat_id'] ?? $chatId, 'apiKey' => $data['apiKey'] ?? '',
                ];
                flash_set('success', 'Bot "' . $name . '" berhasil dibuat di backend.');
            } else {
                flash_set('error', 'Gagal membuat bot: ' . ($data['error'] ?? "HTTP $status"));
            }
            redirect('setting.php');
        }

        if ($action === 'bot_activate') {
            // Simpan id + api key (yang baru saja diketahui) sebagai bot aktif toko ini.
            $id = str_field('id'); $name = str_field('name'); $chatId = str_field('chatId'); $apiKey = str_field('apiKey');
            if ($apiKey === '') { flash_set('error', 'API key tidak ditemukan, silakan rotate key lagi.'); redirect('setting.php'); }
            save_settings(array_merge($SETTINGS, [
                'telegram_bot_id' => $id, 'telegram_bot_name' => $name,
                'telegram_chat_id' => $chatId, 'telegram_api_key' => $apiKey,
            ]));
            flash_set('success', "Bot \"$name\" dijadikan bot aktif untuk toko ini.");
            redirect('setting.php');
        }

        if ($action === 'bot_disconnect') {
            save_settings(array_merge($SETTINGS, [
                'telegram_bot_id' => '', 'telegram_bot_name' => '', 'telegram_api_key' => '', 'telegram_chat_id' => '',
            ]));
            flash_set('success', 'Bot aktif dilepas dari toko ini (bot tidak dihapus dari backend).');
            redirect('setting.php');
        }

        if ($action === 'bot_update') {
            $id = str_field('id');
            $fields = [];
            if (str_field('name') !== '') $fields['name'] = str_field('name');
            if (str_field('chatId') !== '') $fields['chatId'] = str_field('chatId');
            if (str_field('botToken') !== '') $fields['botToken'] = str_field('botToken');
            if (!$fields) { flash_set('error', 'Tidak ada perubahan yang dikirim.'); redirect('setting.php'); }
            [$status, $data] = tg_update_bot($id, $fields);
            if ($status === 200 && !empty($data['ok'])) {
                // Sinkronkan cache lokal kalau ini bot yang sedang aktif.
                if ($SETTINGS['telegram_bot_id'] === $id) {
                    $upd = $SETTINGS;
                    if (isset($fields['name'])) $upd['telegram_bot_name'] = $fields['name'];
                    if (isset($fields['chatId'])) $upd['telegram_chat_id'] = $fields['chatId'];
                    save_settings($upd);
                }
                flash_set('success', 'Bot berhasil diperbarui.');
            } else {
                flash_set('error', 'Gagal memperbarui bot: ' . ($data['error'] ?? "HTTP $status"));
            }
            redirect('setting.php');
        }

        if ($action === 'bot_toggle') {
            $id = str_field('id');
            $enabled = str_field('enabled') === '1';
            [$status, $data] = tg_update_bot($id, ['enabled' => $enabled]);
            flash_set(($status === 200 && !empty($data['ok'])) ? 'success' : 'error',
                ($status === 200 && !empty($data['ok'])) ? ($enabled ? 'Bot diaktifkan.' : 'Bot dinonaktifkan.') : 'Gagal mengubah status: ' . ($data['error'] ?? "HTTP $status"));
            redirect('setting.php');
        }

        if ($action === 'bot_delete') {
            $id = str_field('id');
            [$status, $data] = tg_delete_bot($id);
            if ($status === 200 && !empty($data['ok'])) {
                if ($SETTINGS['telegram_bot_id'] === $id) {
                    save_settings(array_merge($SETTINGS, ['telegram_bot_id' => '', 'telegram_bot_name' => '', 'telegram_api_key' => '', 'telegram_chat_id' => '']));
                }
                flash_set('success', 'Bot berhasil dihapus dari backend.');
            } else {
                flash_set('error', 'Gagal menghapus bot: ' . ($data['error'] ?? "HTTP $status"));
            }
            redirect('setting.php');
        }

        if ($action === 'bot_rotate') {
            $id = str_field('id');
            [$status, $data] = tg_rotate_key($id);
            if ($status === 200 && !empty($data['ok'])) {
                $_SESSION['new_api_key'] = [
                    'id' => $id, 'name' => $data['bot']['name'] ?? '-',
                    'chatId' => $SETTINGS['telegram_bot_id'] === $id ? $SETTINGS['telegram_chat_id'] : '',
                    'apiKey' => $data['apiKey'] ?? '',
                ];
                // Kalau ini bot aktif, langsung update api key tersimpan (chat id/nama tidak berubah).
                if ($SETTINGS['telegram_bot_id'] === $id) {
                    save_settings(array_merge($SETTINGS, ['telegram_api_key' => $data['apiKey'] ?? '']));
                    flash_set('success', 'API key baru dibuat dan langsung dipakai (bot ini sedang aktif). API key lama tidak berlaku lagi.');
                } else {
                    flash_set('success', 'API key baru dibuat. API key lama langsung tidak berlaku. Klik "Jadikan Aktif" kalau ingin memakainya di toko ini.');
                }
            } else {
                flash_set('error', 'Gagal rotate API key: ' . ($data['error'] ?? "HTTP $status"));
            }
            redirect('setting.php');
        }

        if ($action === 'bot_test') {
            $msg = str_field('message') ?: ('Tes notifikasi dari panel Setting ' . $SETTINGS['store_name'] . '. Waktu: ' . wib());
            $result = tg_notify($msg);
            flash_set($result['ok'] ? 'success' : 'error', $result['ok'] ? 'Pesan tes berhasil dikirim ke Telegram.' : ('Gagal mengirim: ' . $result['error']));
            redirect('setting.php');
        }
    }

    /* ---- Kelola admin: super_admin saja ---- */
    if ($action === 'admin_update') {
        if (!$isSuper) { flash_set('error', 'Akses ditolak.'); redirect('setting.php'); }
        $rid = (int) ($_POST['id'] ?? 0);
        $users = get_users();
        $idx = null;
        foreach ($users as $i => $u) if ((int) $u['id'] === $rid) { $idx = $i; break; }
        if ($idx === null) { flash_set('error', 'Admin tidak ditemukan.'); redirect('setting.php'); }

        $role = in_array(str_field('role'), ['admin', 'verified_admin', 'super_admin'], true) ? str_field('role') : 'admin';
        $status = str_field('status') === 'active' ? 'active' : 'disabled';
        if ($rid === (int) $CURRENT_USER['id'] && ($role !== 'super_admin' || $status !== 'active')) {
            flash_set('error', 'Kamu tidak bisa menurunkan role atau menonaktifkan akunmu sendiri.');
            redirect('setting.php');
        }
        $password = (string) ($_POST['password'] ?? '');
        if ($password !== '' && strlen($password) < 6) {
            flash_set('error', 'Password baru minimal 6 karakter.');
            redirect('setting.php');
        }
        $users[$idx]['name'] = str_field('name') ?: $users[$idx]['name'];
        $users[$idx]['email'] = str_field('email');
        $users[$idx]['role'] = $role;
        $users[$idx]['status'] = $status;
        $users[$idx]['verified'] = isset($_POST['verified']);
        if ($password !== '') $users[$idx]['password'] = password_hash($password, PASSWORD_BCRYPT);
        save_users($users);
        flash_set('success', 'Admin "' . $users[$idx]['username'] . '" diperbarui.');
        redirect('setting.php');
    }

    if ($action === 'admin_new') {
        if (!$isSuper) { flash_set('error', 'Akses ditolak.'); redirect('setting.php'); }
        $username = str_field('username');
        $password = (string) ($_POST['password'] ?? '');
        if ($username === '' || strlen($password) < 6) {
            flash_set('error', 'Username wajib dan password minimal 6 karakter.');
            redirect('setting.php');
        }
        $users = get_users();
        foreach ($users as $u) {
            if (strcasecmp((string) $u['username'], $username) === 0) {
                flash_set('error', 'Username sudah dipakai.'); redirect('setting.php');
            }
        }
        $newId = time();
        while (array_filter($users, fn($u) => (int) $u['id'] === $newId)) $newId++;
        $newUser = [
            'id' => $newId, 'username' => $username, 'email' => str_field('email'),
            'name' => str_field('name') ?: $username, 'password' => password_hash($password, PASSWORD_BCRYPT),
            'role' => 'admin', 'verified' => false, 'status' => 'active',
        ];

        if (!tg_configured($SETTINGS)) {
            $users[] = $newUser;
            save_users($users);
            flash_set('success', 'Akun admin berhasil dibuat. (Hubungkan bot Telegram di bawah agar pembuatan akun berikutnya diamankan dengan OTP.)');
            redirect('setting.php');
        }

        $otp = (string) random_int(100000, 999999);
        $_SESSION['pending_admin'] = ['data' => $newUser, 'otp' => $otp, 'expires' => time() + 300];
        $sent = tg_notify(
            "🔐 *Kode OTP Pembuatan Akun Admin*\n\nUsername baru: " . tg_md($username) .
            "\nDiminta oleh: " . tg_md($CURRENT_USER['username']) . "\n\nKode OTP: *$otp*\nBerlaku 5 menit."
        );
        if (!$sent['ok']) {
            unset($_SESSION['pending_admin']);
            flash_set('error', 'OTP gagal dikirim ke Telegram: ' . $sent['error']);
            redirect('setting.php');
        }
        flash_set('success', 'Kode OTP telah dikirim ke Telegram. Masukkan kode untuk mengonfirmasi pembuatan akun.');
        redirect('setting.php');
    }

    if ($action === 'admin_confirm_otp') {
        if (!$isSuper) { flash_set('error', 'Akses ditolak.'); redirect('setting.php'); }
        $pending = $_SESSION['pending_admin'] ?? null;
        if (!$pending) { flash_set('error', 'Tidak ada proses pembuatan akun yang menunggu konfirmasi.'); redirect('setting.php'); }
        if (time() > $pending['expires']) {
            unset($_SESSION['pending_admin']);
            flash_set('error', 'Kode OTP sudah kedaluwarsa. Silakan buat ulang akunnya.');
            redirect('setting.php');
        }
        if (!rate_limit_ok('otp', 5, 300)) {
            unset($_SESSION['pending_admin']);
            flash_set('error', 'Terlalu banyak percobaan OTP. Silakan buat ulang akunnya.');
            redirect('setting.php');
        }
        if (!hash_equals($pending['otp'], str_field('otp'))) {
            flash_set('error', 'Kode OTP salah. Coba periksa kembali pesan Telegram.');
            redirect('setting.php');
        }
        $users = get_users();
        $users[] = $pending['data'];
        save_users($users);
        unset($_SESSION['pending_admin']);
        tg_notify('✅ *Akun Admin Baru Dibuat*' . "\n\nUsername: " . tg_md($pending['data']['username']) . "\nWaktu: " . wib());
        flash_set('success', 'OTP benar. Akun admin baru berhasil dibuat.');
        redirect('setting.php');
    }

    if ($action === 'admin_cancel_otp') {
        unset($_SESSION['pending_admin']);
        flash_set('success', 'Proses pembuatan akun dibatalkan.');
        redirect('setting.php');
    }

    flash_set('error', 'Aksi tidak dikenal.');
    redirect('setting.php');
}

/* =============== Data untuk render =============== */
$users = get_users();
$pending = $_SESSION['pending_admin'] ?? null;
$pendingActive = ($pending && $pending['expires'] > time()) ? $pending : null;

$bots = [];
$botsError = null;
if ($isSuper) {
    [$listStatus, $listData] = tg_list_bots();
    if ($listStatus === 200 && !empty($listData['ok'])) $bots = $listData['bots'] ?? [];
    else $botsError = 'Gagal mengambil daftar bot dari backend: ' . ($listData['error'] ?? "HTTP $listStatus");
}
$activeBotStillExists = !$SETTINGS['telegram_bot_id'] || array_filter($bots, fn($b) => ($b['id'] ?? '') === $SETTINGS['telegram_bot_id']);

$PAGE_TITLE = 'Setting';
$ACTIVE_NAV = 'setting';
include __DIR__ . '/includes/admin_shell_top.php';
?>

<div class="page-head">
  <div>
    <h1 class="page-title">Setting Profile</h1>
    <p class="page-desc">Kelola identitas toko, kontak, sosial media, dan akun administrator.</p>
  </div>
</div>

<?php if ($flash): ?><div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'error' ?>"><?= h($flash['msg']) ?></div><?php endif; ?>

<!-- ================= Profile Toko ================= -->
<section class="panel">
  <h2>Profile Toko</h2>
  <p class="muted small" style="margin:-2px 0 16px">Informasi ini tampil pada halaman katalog publik.</p>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <input type="hidden" name="action" value="store">
    <div class="form-grid cols-2">
      <label class="field"><span class="field-label">Nama Toko</span><input class="input" name="store_name" required value="<?= h($SETTINGS['store_name']) ?>"></label>
      <label class="field"><span class="field-label">Email</span><input class="input" type="email" name="email" value="<?= h($SETTINGS['email']) ?>"></label>
      <label class="field full"><span class="field-label">Bio / Deskripsi Toko</span><textarea class="input" name="bio"><?= h($SETTINGS['bio']) ?></textarea></label>
      <label class="field full"><span class="field-label">URL Foto Profile / Logo</span><input class="input" type="url" name="profile_image" value="<?= h($SETTINGS['profile_image']) ?>" placeholder="https://domain.com/logo.png"></label>
      <label class="field"><span class="field-label">Alamat Toko (Lokasi 1)</span><input class="input" name="address" value="<?= h($SETTINGS['address']) ?>"></label>
      <label class="field"><span class="field-label">Alamat Toko (Lokasi 2) — opsional</span><input class="input" name="address2" value="<?= h($SETTINGS['address2']) ?>"></label>
      <label class="field"><span class="field-label">No. Telepon</span><input class="input" name="phone" value="<?= h($SETTINGS['phone']) ?>"></label>
      <label class="field"><span class="field-label">Contact Admin</span><input class="input" name="contact_admin" value="<?= h($SETTINGS['contact_admin']) ?>"></label>
      <label class="field"><span class="field-label">WhatsApp</span><input class="input" name="whatsapp" value="<?= h($SETTINGS['whatsapp']) ?>" placeholder="628xxxxxxxxxx"></label>
      <label class="field"><span class="field-label">Instagram</span><input class="input" name="instagram" value="<?= h($SETTINGS['instagram']) ?>"></label>
      <label class="field"><span class="field-label">Facebook</span><input class="input" name="facebook" value="<?= h($SETTINGS['facebook']) ?>"></label>
      <label class="field"><span class="field-label">TikTok</span><input class="input" name="tiktok" value="<?= h($SETTINGS['tiktok']) ?>"></label>
    </div>
    <button type="submit" class="btn btn-primary" style="margin-top:16px">Simpan Profile Toko</button>
  </form>
</section>

<!-- ================= Profile Saya ================= -->
<section class="panel">
  <h2>Profile Saya</h2>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <input type="hidden" name="action" value="profile">
    <div class="form-grid cols-2">
      <label class="field"><span class="field-label">Nama</span><input class="input" name="name" required value="<?= h($CURRENT_USER['name'] ?? '') ?>"></label>
      <label class="field"><span class="field-label">Email</span><input class="input" type="email" name="email" value="<?= h($CURRENT_USER['email'] ?? '') ?>"></label>
      <label class="field full"><span class="field-label">Password Baru</span><input class="input" type="password" name="password" minlength="6" autocomplete="new-password" placeholder="Kosongkan jika tidak ingin mengubah password"></label>
    </div>
    <button type="submit" class="btn btn-primary" style="margin-top:16px">Update Profile</button>
  </form>
</section>

<?php if ($isSuper): ?>

<!-- ================= Kelola Admin ================= -->
<section class="panel">
  <h2>Kelola Admin</h2>
  <p class="muted small" style="margin:-2px 0 16px">Atur role, status, dan password akun administrator.</p>
  <?php foreach ($users as $u): ?>
    <details class="admin-item">
      <summary>
        <span><strong><?= h($u['name'] ?? $u['username']) ?></strong> <span class="muted small">@<?= h($u['username']) ?></span></span>
        <span style="display:flex;gap:6px">
          <span class="badge badge-role"><?= h(ROLE_LABEL[$u['role']] ?? $u['role']) ?></span>
          <span class="badge <?= ($u['status'] ?? 'active') === 'active' ? 'badge-on' : 'badge-off' ?>"><?= h($u['status'] ?? 'active') ?></span>
        </span>
      </summary>
      <div class="admin-body">
        <form method="post">
          <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
          <input type="hidden" name="action" value="admin_update">
          <input type="hidden" name="id" value="<?= h((string)$u['id']) ?>">
          <div class="form-grid cols-2">
            <label class="field"><span class="field-label">Nama</span><input class="input" name="name" value="<?= h($u['name'] ?? '') ?>"></label>
            <label class="field"><span class="field-label">Email</span><input class="input" type="email" name="email" value="<?= h($u['email'] ?? '') ?>"></label>
            <label class="field"><span class="field-label">Role</span>
              <select class="input" name="role">
                <?php foreach (['admin' => 'Admin', 'verified_admin' => 'Verified Admin', 'super_admin' => 'Super Admin'] as $val => $lbl): ?>
                  <option value="<?= $val ?>" <?= ($u['role'] ?? '') === $val ? 'selected' : '' ?>><?= $lbl ?></option>
                <?php endforeach; ?>
              </select>
            </label>
            <label class="field"><span class="field-label">Status</span>
              <select class="input" name="status">
                <option value="active" <?= ($u['status'] ?? 'active') === 'active' ? 'selected' : '' ?>>Active</option>
                <option value="disabled" <?= ($u['status'] ?? '') === 'disabled' ? 'selected' : '' ?>>Disabled</option>
              </select>
            </label>
            <label class="field"><span class="field-label">Password Baru</span><input class="input" type="password" name="password" minlength="6" autocomplete="new-password"><p class="field-hint">Kosongkan jika tidak diubah.</p></label>
            <label class="checkline" style="align-self:center"><input type="checkbox" name="verified" <?= !empty($u['verified']) ? 'checked' : '' ?>> Verified</label>
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="margin-top:14px">Simpan Admin</button>
        </form>
      </div>
    </details>
  <?php endforeach; ?>
</section>

<!-- ================= Buat Admin ================= -->
<section class="panel">
  <h2>Buat Akun Admin</h2>
  <p class="muted small" style="margin:-2px 0 16px">Jika bot Telegram aktif, pembuatan akun harus dikonfirmasi dengan kode OTP yang dikirim ke Telegram.</p>

  <?php if ($pendingActive): ?>
    <div class="alert alert-success">Menunggu konfirmasi OTP untuk akun <strong><?= h($pendingActive['data']['username']) ?></strong>. Kode berlaku 5 menit.</div>
    <form method="post" style="max-width:280px">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="admin_confirm_otp">
      <label class="field"><span class="field-label">Kode OTP</span><input class="input" name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 digit"></label>
      <button type="submit" class="btn btn-primary" style="margin-top:12px">Konfirmasi OTP</button>
    </form>
    <form method="post" style="margin-top:10px">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="admin_cancel_otp">
      <button type="submit" class="btn">Batalkan</button>
    </form>
  <?php else: ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="admin_new">
      <div class="form-grid cols-2">
        <label class="field"><span class="field-label">Username</span><input class="input" name="username" required autocomplete="off"></label>
        <label class="field"><span class="field-label">Nama</span><input class="input" name="name"></label>
        <label class="field"><span class="field-label">Email</span><input class="input" type="email" name="email"></label>
        <label class="field"><span class="field-label">Password (min. 6 karakter)</span><input class="input" type="password" name="password" minlength="6" required autocomplete="new-password"></label>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:16px">Buat Akun</button>
    </form>
  <?php endif; ?>
</section>

<!-- ================= Bot Telegram / API Key Manager ================= -->
<section class="panel">
  <h2>Bot Telegram (Backend Terpusat)</h2>
  <p class="muted small" style="margin:-2px 0 16px">
    Bot dikelola lewat backend Vercel. API key hanya ditampilkan sekali saat bot dibuat / di-rotate.
  </p>

  <?php if ($botsError): ?><div class="alert alert-error"><?= h($botsError) ?></div><?php endif; ?>

  <?php if ($newApiKey): ?>
    <div class="alert alert-warning">
      <strong>API key untuk "<?= h($newApiKey['name']) ?>":</strong>
      <div class="apikey-box">
        <code id="new-api-key"><?= h($newApiKey['apiKey']) ?></code>
        <button type="button" class="btn btn-sm" onclick="copyKey()">Copy</button>
        <?php if ($newApiKey['apiKey'] && $SETTINGS['telegram_bot_id'] !== $newApiKey['id']): ?>
          <form method="post" class="inline-form">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="action" value="bot_activate">
            <input type="hidden" name="id" value="<?= h($newApiKey['id']) ?>">
            <input type="hidden" name="name" value="<?= h($newApiKey['name']) ?>">
            <input type="hidden" name="chatId" value="<?= h($newApiKey['chatId']) ?>">
            <input type="hidden" name="apiKey" value="<?= h($newApiKey['apiKey']) ?>">
            <button type="submit" class="btn btn-sm btn-primary">Jadikan Bot Aktif Toko Ini</button>
          </form>
        <?php endif; ?>
      </div>
      <p class="muted small" style="margin-top:8px">Simpan sekarang juga. Kode ini <strong>tidak akan ditampilkan lagi</strong> setelah halaman ini di-refresh.</p>
    </div>
  <?php endif; ?>

  <!-- Bot aktif toko ini -->
  <?php if ($SETTINGS['telegram_bot_id'] && $SETTINGS['telegram_api_key']): ?>
    <div class="panel" style="background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.25)">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
        <div>
          <span class="badge badge-on"><i class="fa-solid fa-circle-check"></i> Bot Aktif</span>
          <div style="margin-top:8px;font-weight:800;font-size:15px"><?= h($SETTINGS['telegram_bot_name'] ?: '(nama tidak diketahui)') ?></div>
          <div class="muted small">Chat ID: <code><?= h($SETTINGS['telegram_chat_id']) ?></code></div>
          <?php if (!$activeBotStillExists): ?>
            <div class="alert alert-error" style="margin-top:10px">Bot ini sudah tidak ada di backend (mungkin terhapus). Lepas dan hubungkan bot lain.</div>
          <?php endif; ?>
        </div>
        <form method="post" onsubmit="return confirm('Lepas bot aktif dari toko ini? (Bot tidak akan dihapus dari backend.)');">
          <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
          <input type="hidden" name="action" value="bot_disconnect">
          <button type="submit" class="btn btn-sm">Lepas Bot Aktif</button>
        </form>
      </div>
    </div>

    <form method="post" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="bot_test">
      <label class="field" style="flex:1;min-width:220px"><span class="field-label">Pesan Tes</span><input class="input" name="message" placeholder="Tes dari panel Setting"></label>
      <button type="submit" class="btn btn-primary">Kirim Pesan Tes</button>
    </form>
  <?php else: ?>
    <div class="alert alert-warning">Belum ada bot aktif untuk toko ini. Buat bot baru di bawah, atau pilih dari daftar bot lalu klik Rotate Key untuk mengambil-alih.</div>
  <?php endif; ?>

  <!-- Daftar semua bot di backend -->
  <?php if ($bots): ?>
    <div class="table-wrap" style="margin-top:18px">
      <table class="tbl">
        <thead><tr><th>Nama</th><th>Chat ID</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead>
        <tbody>
        <?php foreach ($bots as $bot): $bid = h($bot['id'] ?? ''); $isActive = $SETTINGS['telegram_bot_id'] === ($bot['id'] ?? ''); ?>
          <tr>
            <td><strong><?= h($bot['name'] ?? '-') ?></strong> <?php if ($isActive): ?><span class="badge badge-on" style="margin-left:6px">Aktif di sini</span><?php endif; ?></td>
            <td><code><?= h($bot['chat_id'] ?? '-') ?></code></td>
            <td><span class="badge <?= !empty($bot['enabled']) ? 'badge-on' : 'badge-off' ?>"><?= !empty($bot['enabled']) ? 'Aktif' : 'Nonaktif' ?></span></td>
            <td class="muted small"><?= h(isset($bot['created_at']) ? date('d M Y', strtotime($bot['created_at'])) : '-') ?></td>
            <td>
              <div class="row-actions">
                <button type="button" class="btn btn-sm" onclick="toggleEdit('edit-<?= $bid ?>')">Edit</button>
                <form method="post" class="inline-form">
                  <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                  <input type="hidden" name="action" value="bot_toggle">
                  <input type="hidden" name="id" value="<?= $bid ?>">
                  <input type="hidden" name="enabled" value="<?= !empty($bot['enabled']) ? '0' : '1' ?>">
                  <button type="submit" class="btn btn-sm"><?= !empty($bot['enabled']) ? 'Nonaktifkan' : 'Aktifkan' ?></button>
                </form>
                <form method="post" class="inline-form" onsubmit="return confirm('API key lama langsung tidak berlaku. Lanjutkan rotate key?');">
                  <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                  <input type="hidden" name="action" value="bot_rotate">
                  <input type="hidden" name="id" value="<?= $bid ?>">
                  <button type="submit" class="btn btn-sm btn-warning">Rotate Key</button>
                </form>
                <form method="post" class="inline-form" onsubmit="return confirm('Hapus bot &quot;<?= h($bot['name'] ?? '') ?>&quot;? Tidak bisa dibatalkan.');">
                  <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                  <input type="hidden" name="action" value="bot_delete">
                  <input type="hidden" name="id" value="<?= $bid ?>">
                  <button type="submit" class="btn btn-sm btn-danger">Hapus</button>
                </form>
              </div>
              <div id="edit-<?= $bid ?>" class="edit-panel hidden">
                <form method="post" class="form-grid cols-2">
                  <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                  <input type="hidden" name="action" value="bot_update">
                  <input type="hidden" name="id" value="<?= $bid ?>">
                  <label class="field"><span class="field-label">Nama</span><input class="input" name="name" placeholder="<?= h($bot['name'] ?? '') ?>"></label>
                  <label class="field"><span class="field-label">Chat ID Baru</span><input class="input" name="chatId" placeholder="<?= h($bot['chat_id'] ?? '') ?>"></label>
                  <label class="field full"><span class="field-label">Bot Token Baru</span><input class="input" name="botToken" placeholder="Kosongkan jika tidak diubah" autocomplete="off"></label>
                  <div class="full"><button type="submit" class="btn btn-sm btn-primary">Simpan Perubahan</button></div>
                </form>
              </div>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>

  <!-- Tambah bot baru -->
  <div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--border)">
    <h2 style="font-size:15px">Tambah Bot Baru</h2>
    <form method="post" class="form-grid cols-2" style="margin-top:10px">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="bot_create">
      <label class="field"><span class="field-label">Nama Bot</span><input class="input" name="name" required placeholder="Contoh: Geotama Order"></label>
      <label class="field"><span class="field-label">Bot Token</span><input class="input" name="botToken" required autocomplete="off" placeholder="123456:ABC-DEF..."></label>
      <label class="field full"><span class="field-label">Chat ID</span><input class="input" name="chatId" required autocomplete="off" placeholder="123456789"></label>
      <div class="full"><button type="submit" class="btn btn-primary">Buat Bot di Backend</button></div>
    </form>
  </div>
</section>

<?php endif; ?>

<script>
function toggleEdit(id){ document.getElementById(id).classList.toggle('hidden'); }
function copyKey(){
  const el = document.getElementById('new-api-key');
  navigator.clipboard.writeText(el.textContent.trim()).then(()=>alert('API key disalin.'));
}
</script>

<?php include __DIR__ . '/includes/admin_shell_bottom.php'; ?>
