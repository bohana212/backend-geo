<?php
require_once __DIR__ . '/includes/common.php';

$CURRENT_USER = require_role(['verified_admin', 'super_admin'], 'edit.php');
$SETTINGS = get_settings();

$action = (string) ($_GET['action'] ?? '');
$id = (int) ($_GET['id'] ?? 0);
$products = get_products();

/* ---------- Simpan / Hapus ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $formAction = (string) ($_POST['form_action'] ?? '');

    if ($formAction === 'save') {
        $pid = (int) ($_POST['id'] ?? 0);
        $name = str_field('name');
        $category = str_field('category');

        if ($name === '' || $category === '') {
            flash_set('error', 'Nama produk dan kategori wajib diisi.');
            redirect('edit.php?action=' . ($pid ? "edit&id=$pid" : 'add'));
        }

        $data = [
            'name' => $name,
            'category' => $category,
            'price' => max(0, (float) ($_POST['price'] ?? 0)),
            'stock' => max(0, (int) ($_POST['stock'] ?? 0)),
            'description' => str_field('description'),
            'image' => str_field('image'),
            'flash_sale' => isset($_POST['flash_sale']),
        ];
        foreach (category_specs($category) as $spec) {
            $data[$spec['key']] = str_field('spec_' . $spec['key']);
        }

        if ($pid > 0) {
            $found = false;
            foreach ($products as $i => $p) {
                if ((int) ($p['id'] ?? 0) === $pid) {
                    $products[$i] = array_merge($p, $data, ['id' => $pid]);
                    $found = true;
                    break;
                }
            }
            if (!$found) { flash_set('error', 'Produk tidak ditemukan.'); redirect('edit.php'); }
        } else {
            $maxId = 0;
            foreach ($products as $p) $maxId = max($maxId, (int) ($p['id'] ?? 0));
            $data['id'] = $maxId + 1;
            $products[] = $data;
        }
        save_products($products);
        flash_set('success', 'Produk berhasil disimpan.');
        redirect('edit.php');
    }

    if ($formAction === 'delete') {
        $pid = (int) ($_POST['id'] ?? 0);
        $products = array_values(array_filter($products, fn($p) => (int) ($p['id'] ?? 0) !== $pid));
        save_products($products);
        flash_set('success', 'Produk berhasil dihapus.');
        redirect('edit.php');
    }
}

$found = null;
if ($id) {
    foreach ($products as $p) if ((int) ($p['id'] ?? 0) === $id) { $found = $p; break; }
}
$showForm = $action === 'add' || ($id && $action !== 'list');
$notFound = $showForm && $action !== 'add' && !$found;
$flash = flash_get();

$PAGE_TITLE = 'Kelola Produk';
$ACTIVE_NAV = 'edit';
include __DIR__ . '/includes/admin_shell_top.php';
?>

<?php if ($showForm && !$notFound):
    $category = (string) ($_GET['preview_category'] ?? $found['category'] ?? '');
    $specs = $category ? category_specs($category) : [];
?>
  <div class="page-head">
    <div>
      <h1 class="page-title"><?= $found ? 'Edit Produk' : 'Tambah Produk' ?></h1>
      <p class="page-desc">Kelola informasi produk dan spesifikasi berdasarkan kategori.</p>
    </div>
    <a href="edit.php" class="btn"><i class="fa-solid fa-arrow-left"></i> Kembali</a>
  </div>

  <form method="post" class="panel" id="product-form">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <input type="hidden" name="form_action" value="save">
    <input type="hidden" name="id" value="<?= h((string)($found['id'] ?? '')) ?>">

    <h2>Informasi Produk</h2>
    <div class="form-grid cols-2">
      <label class="field full">
        <span class="field-label">Nama Produk *</span>
        <input class="input" name="name" required value="<?= h($found['name'] ?? '') ?>" placeholder="Contoh: Epson L3210">
      </label>

      <label class="field">
        <span class="field-label">Kategori *</span>
        <select class="input" name="category" id="category-select" required onchange="document.getElementById('product-form').submit_pending=true; window.location.href='edit.php?action=<?= $found ? 'edit&id='.$found['id'] : 'add' ?>&preview_category='+encodeURIComponent(this.value)">
          <option value="">— Pilih Kategori —</option>
          <?php foreach (CATEGORIES as $c): ?>
            <option value="<?= h($c) ?>" <?= strcasecmp($c, $category) === 0 ? 'selected' : '' ?>><?= h($c) ?></option>
          <?php endforeach; ?>
        </select>
        <p class="field-hint">Pilih kategori untuk menampilkan spesifikasi yang sesuai (halaman akan reload menampilkan field spesifikasi).</p>
      </label>

      <label class="field"><span class="field-label">Harga Jual</span>
        <input class="input" type="number" min="0" step="1" name="price" value="<?= h((string)($found['price'] ?? '')) ?>" placeholder="Contoh: 3500000">
      </label>
      <label class="field"><span class="field-label">Stok</span>
        <input class="input" type="number" min="0" step="1" name="stock" value="<?= h((string)($found['stock'] ?? '')) ?>" placeholder="0">
      </label>
      <label class="field"><span class="field-label">URL Gambar</span>
        <input class="input" name="image" value="<?= h($found['image'] ?? '') ?>" placeholder="https://.../gambar.jpg">
        <p class="field-hint">Gunakan URL gambar langsung (https://...).</p>
      </label>

      <label class="field full"><span class="field-label">Deskripsi Produk</span>
        <textarea class="input" name="description" placeholder="Tulis deskripsi singkat produk..."><?= h($found ? product_description($found) : '') ?></textarea>
      </label>

      <label class="checkline full">
        <input type="checkbox" name="flash_sale" <?= $found && is_flash($found) ? 'checked' : '' ?>>
        <i class="fa-solid fa-bolt" style="color:#facc15"></i> Tandai sebagai Flash Sale
      </label>
    </div>

    <?php if ($specs): ?>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
        <h2>Spesifikasi Produk</h2>
        <p class="muted small" style="margin:-2px 0 16px">Field spesifikasi otomatis berubah mengikuti kategori produk.</p>
        <div class="form-grid cols-2">
          <?php foreach ($specs as $s): ?>
            <label class="field">
              <span class="field-label"><?= h($s['label']) ?></span>
              <input class="input" name="spec_<?= h($s['key']) ?>" value="<?= h((string)($found[$s['key']] ?? '')) ?>" placeholder="<?= h($s['label']) ?>">
            </label>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>

    <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:10px">
      <a href="edit.php" class="btn">Batal</a>
      <button type="submit" class="btn btn-primary"><?= $found ? 'Simpan Perubahan' : 'Tambah Produk' ?></button>
    </div>
  </form>

<?php else: ?>

  <div class="page-head">
    <div>
      <h1 class="page-title">Kelola Produk</h1>
      <p class="page-desc">Tambah, edit, dan hapus produk <?= h($SETTINGS['store_name']) ?>.</p>
    </div>
    <a href="edit.php?action=add" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Tambah Barang</a>
  </div>

  <?php if ($flash): ?><div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'error' ?>"><?= h($flash['msg']) ?></div><?php endif; ?>
  <?php if ($notFound): ?><div class="alert alert-error">Produk tidak ditemukan.</div><?php endif; ?>

  <section class="panel panel-flat">
    <div class="panel-flat-head">
      <h2 style="margin:0">Daftar Produk</h2>
      <span class="muted small"><?= count($products) ?> produk</span>
    </div>

    <?php if (!$products): ?>
      <div style="padding:0 20px 30px" class="muted">Belum ada produk. <a href="edit.php?action=add" style="color:#38bdf8;text-decoration:underline">Tambahkan produk pertama</a></div>
    <?php else: ?>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Spesifikasi</th><th>Aksi</th></tr></thead>
          <tbody>
          <?php foreach ($products as $p):
              $specs = category_specs((string)($p['category'] ?? ''));
              $filled = count(array_filter($specs, fn($s) => trim((string)($p[$s['key']] ?? '')) !== ''));
              $stock = (int) ($p['stock'] ?? 0);
              $image = trim((string)($p['image'] ?? ''));
              $pid = (int) ($p['id'] ?? 0);
          ?>
            <tr>
              <td>
                <div class="prod-row">
                  <div class="thumb"><?php if ($image): ?><img src="<?= h($image) ?>" alt=""><?php else: ?><i class="fa-solid fa-image"></i><?php endif; ?></div>
                  <div>
                    <div style="font-weight:700"><?= h($p['name'] ?? '') ?></div>
                    <div class="small muted">ID #<?= $pid ?></div>
                  </div>
                </div>
              </td>
              <td class="muted"><?= h($p['category'] ?? '') ?></td>
              <td style="white-space:nowrap;font-weight:700"><?= rupiah($p['price'] ?? 0) ?></td>
              <td><?= $stock > 0 ? $stock : '<span style="color:#fda4af">Habis</span>' ?></td>
              <td class="small muted"><?= $filled ?>/<?= count($specs) ?> field terisi</td>
              <td>
                <div class="row-actions">
                  <a href="edit.php?action=edit&id=<?= $pid ?>" class="icon-btn" title="Edit"><i class="fa-solid fa-pen"></i></a>
                  <a href="index.php" target="_blank" class="icon-btn" title="Lihat Toko"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                  <form method="post" class="inline-form" onsubmit="return confirm('Hapus produk &quot;<?= h($p['name'] ?? '') ?>&quot;?');">
                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                    <input type="hidden" name="form_action" value="delete">
                    <input type="hidden" name="id" value="<?= $pid ?>">
                    <button type="submit" class="icon-btn danger" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                  </form>
                </div>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </section>

<?php endif; ?>

<?php include __DIR__ . '/includes/admin_shell_bottom.php'; ?>
