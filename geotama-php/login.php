<?php
require_once __DIR__ . '/includes/common.php';

if (current_user()) redirect('dashboard.php');

$next = safe_next((string) ($_GET['next'] ?? $_POST['next'] ?? ''));
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $username = str_field('username');
    $password = (string) ($_POST['password'] ?? '');
    if ($username === '' || $password === '') {
        $error = 'Username dan password wajib diisi.';
    } else {
        $result = attempt_login($username, $password);
        if ($result['ok']) redirect($next);
        $error = $result['error'];
    }
}

$settings = get_settings();
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Login — <?= h($settings['store_name']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-logo"><i class="fa-solid fa-microchip"></i></div>
    <h1 class="auth-title">Admin Login</h1>
    <p class="auth-sub">Masuk untuk mengelola produk dan toko <?= h($settings['store_name']) ?>.</p>

    <div class="panel">
      <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
      <form method="post" autocomplete="off">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <input type="hidden" name="next" value="<?= h($next) ?>">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Username</span>
            <input class="input" type="text" name="username" required autofocus autocomplete="username">
          </label>
          <label class="field">
            <span class="field-label">Password</span>
            <input class="input" type="password" name="password" required autocomplete="current-password">
          </label>
        </div>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:16px">
          <i class="fa-solid fa-right-to-bracket"></i> Login
        </button>
      </form>
    </div>
    <p class="muted small" style="text-align:center"><i class="fa-solid fa-circle-check" style="color:#4ade80"></i> Secure admin authentication</p>
  </div>
</div>
</body>
</html>
