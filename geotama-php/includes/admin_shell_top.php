<?php
/** @var array $CURRENT_USER  @var string $ACTIVE_NAV  @var array $SETTINGS */
$canManage = can_manage_products($CURRENT_USER);
$isSuper = is_super_admin($CURRENT_USER);
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($PAGE_TITLE ?? 'Admin') ?> — <?= h($SETTINGS['store_name']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a href="dashboard.php" class="brand">
      <span class="brand-logo"><i class="fa-solid fa-microchip"></i></span>
      <span>
        <span class="brand-name" style="display:block"><?= h($SETTINGS['store_name']) ?></span>
        <span class="brand-sub" style="display:block">Admin Panel</span>
      </span>
    </a>
    <nav class="nav">
      <a href="dashboard.php" class="navlink<?= $ACTIVE_NAV === 'dashboard' ? ' active' : '' ?>"><i class="fa-solid fa-gauge"></i> Dashboard</a>
      <a href="edit.php" class="navlink<?= $ACTIVE_NAV === 'edit' ? ' active' : '' ?>"><i class="fa-solid fa-box"></i> Produk</a>
      <?php if ($canManage): ?>
        <a href="setting.php" class="navlink<?= $ACTIVE_NAV === 'setting' ? ' active' : '' ?>"><i class="fa-solid fa-gear"></i> Setting</a>
      <?php endif; ?>
      <a href="index.php" target="_blank" class="navlink"><i class="fa-solid fa-store"></i> Lihat Toko</a>
      <a href="logout.php" class="btn btn-sm"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
    </nav>
  </div>
</header>
<main class="page">
