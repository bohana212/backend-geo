<?php
require_once __DIR__ . '/includes/common.php';

$CURRENT_USER = require_login('dashboard.php');
$SETTINGS = get_settings();
$products = get_products();
$canManage = can_manage_products($CURRENT_USER);

$statuses = array_map('admin_status', $products);
$stats = [
    ['label' => 'Total Produk', 'value' => count($products), 'icon' => 'fa-boxes-stacked', 'tone' => '#facc15'],
    ['label' => 'Ready Stock', 'value' => count(array_filter($statuses, fn($s) => $s === 'ready')), 'icon' => 'fa-circle-check', 'tone' => '#4ade80'],
    ['label' => 'Out of Stock', 'value' => count(array_filter($statuses, fn($s) => $s === 'out')), 'icon' => 'fa-box-open', 'tone' => '#fb7185'],
    ['label' => 'Restocking', 'value' => count(array_filter($statuses, fn($s) => $s === 'restocking')), 'icon' => 'fa-arrows-rotate', 'tone' => '#fde68a'],
    ['label' => 'Flash Sale', 'value' => count(array_filter($products, 'is_flash')), 'icon' => 'fa-bolt', 'tone' => '#22d3ee'],
];
$SUMMARY_KEYS = ['brand', 'cpu', 'ram', 'ssd', 'vga', 'display'];

$PAGE_TITLE = 'Dashboard';
$ACTIVE_NAV = 'dashboard';
include __DIR__ . '/includes/admin_shell_top.php';
?>

<div class="page-head">
  <div>
    <h1 class="page-title">Dashboard</h1>
    <p class="page-desc">
      <?= h($CURRENT_USER['name'] ?? $CURRENT_USER['username']) ?> •
      <?= h(ROLE_LABEL[$CURRENT_USER['role']] ?? $CURRENT_USER['role']) ?>
      <?= !empty($CURRENT_USER['verified']) ? ' • Verified' : '' ?>
    </p>
  </div>
  <?php if ($canManage): ?>
    <a href="edit.php?action=add" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Tambah Produk</a>
  <?php endif; ?>
</div>

<div class="stat-grid">
  <?php foreach ($stats as $s): ?>
    <div class="stat-card">
      <i class="fa-solid <?= h($s['icon']) ?>" style="color:<?= h($s['tone']) ?>"></i>
      <div class="num"><?= h((string)$s['value']) ?></div>
      <div class="lbl"><?= h($s['label']) ?></div>
    </div>
  <?php endforeach; ?>
</div>

<section class="panel panel-flat">
  <div class="panel-flat-head">
    <h2 style="margin:0">Product Inventory</h2>
    <span class="muted small"><?= count($products) ?> produk terdaftar</span>
  </div>

  <?php if (!$products): ?>
    <div style="padding:10px 20px 36px;text-align:center" class="muted">
      <i class="fa-solid fa-box-open" style="font-size:38px;color:#334155;display:block;margin-bottom:10px"></i>
      <p style="color:#e2e8f0;font-weight:700;margin:0 0 6px">Belum ada produk</p>
      <p style="margin:0 0 16px">Tambahkan produk pertama melalui menu Produk.</p>
      <?php if ($canManage): ?><a href="edit.php?action=add" class="btn btn-primary">Tambah Produk</a><?php endif; ?>
    </div>
  <?php else: ?>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Produk</th><th>Spesifikasi</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
        <?php foreach ($products as $p):
            $st = STATUS_META[admin_status($p)];
            $specs = array_values(array_filter(array_map(fn($k) => trim((string)($p[$k] ?? '')), $SUMMARY_KEYS)));
            $image = trim((string)($p['image'] ?? ''));
        ?>
          <tr>
            <td>
              <div class="prod-row">
                <div class="thumb"><?php if ($image): ?><img src="<?= h($image) ?>" alt=""><?php else: ?><i class="fa-solid fa-image"></i><?php endif; ?></div>
                <div>
                  <div style="font-weight:700"><?= h($p['name'] ?? 'Unnamed Product') ?></div>
                  <div class="small muted"><?= h($p['category'] ?? 'Uncategorized') ?></div>
                </div>
              </div>
            </td>
            <td>
              <?php if ($specs): foreach ($specs as $sp): ?><span class="chip"><?= h($sp) ?></span><?php endforeach; else: ?>
                <span class="small muted">Tidak ada spesifikasi</span>
              <?php endif; ?>
            </td>
            <td style="white-space:nowrap;font-weight:700"><?= rupiah($p['price'] ?? 0) ?></td>
            <td>
              <span class="badge <?= $st['cls'] ?>"><i class="fa-solid <?= $st['icon'] ?>"></i> <?= $st['label'] ?></span>
              <?php if (is_flash($p)): ?><span class="badge badge-flash"><i class="fa-solid fa-bolt"></i> FLASH SALE</span><?php endif; ?>
            </td>
            <td>
              <div class="row-actions">
                <?php if ($canManage): ?>
                  <a href="edit.php?action=edit&id=<?= h((string)$p['id']) ?>" class="icon-btn" title="Edit"><i class="fa-solid fa-pen"></i></a>
                <?php endif; ?>
              </div>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</section>

<?php include __DIR__ . '/includes/admin_shell_bottom.php'; ?>
