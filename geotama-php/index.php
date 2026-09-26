<?php
require_once __DIR__ . '/includes/common.php';

$S = get_settings();

$storeName = $S['store_name'] ?: 'GEOTAMA COMPUTER';
$bio = $S['bio'] ?: 'Solusi komputer, laptop, networking dan kebutuhan IT.';
$wa = wa_number($S['whatsapp'] ?: $S['phone']);

$waBase = $wa ? "https://wa.me/$wa" : '#';
$generalWaText = "Halo $storeName, saya ingin bertanya mengenai produk komputer.";
$generalWa = $wa
    ? $waBase . '?text=' . rawurlencode($generalWaText)
    : '#';

$allProducts = get_products();
$products = [];

foreach ($allProducts as $i => $p) {
    $stock = (int) ($p['stock'] ?? 0);
    $status = catalog_status($stock);
    $price = (float) ($p['price'] ?? 0);

    $category = (string) ($p['category'] ?? 'Lainnya');
    $sku = (string) ($p['sku'] ?? $p['code'] ?? '');
    $name = (string) ($p['name'] ?? 'Produk');
    $brand = (string) ($p['brand'] ?? '');

    $desc = product_description($p) ?: 'Produk komputer berkualitas.';
    $image = (string) ($p['image'] ?? $p['image_url'] ?? '');

    $waText =
        "Halo $storeName, saya tertarik dengan produk:\n\n" .
        "Nama: $name\n" .
        "Harga: " . rupiah($price) . "\n" .
        ($sku ? "SKU: $sku\n" : '') .
        "\nApakah produk ini masih tersedia?";

    $products[] = [
        'key' => (string) ($p['id'] ?? $i),
        'name' => $name,
        'brand' => $brand,
        'category' => $category,
        'description' => $desc,
        'price' => $price,
        'priceText' => rupiah($price),
        'stock' => $stock,
        'image' => $image,
        'sku' => $sku,
        'flash' => is_flash($p),
        'statusLabel' => $status['label'],
        'statusClass' => $status['cls'],
        'statusIcon' => $status['icon'],
        'waHref' => $wa ? $waBase . '?text=' . rawurlencode($waText) : '#',
        'search' => mb_strtolower(
            implode(' ', [$name, $brand, $category, $desc, $sku])
        ),
    ];
}

$totalReady = count(array_filter($products, fn($p) => $p['stock'] > 0));
$totalFlash = count(array_filter($products, fn($p) => $p['flash']));
$totalLimited = count(array_filter(
    $products,
    fn($p) => $p['stock'] > 0 && $p['stock'] <= 3
));

function maps_url(string $q): string
{
    return 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($q);
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title><?= h($storeName) ?> — Computer Store Cirebon</title>

<meta
    name="description"
    content="<?= h($storeName) ?> — Laptop, PC, Printer, Networking dan kebutuhan IT."
>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
    rel="stylesheet"
>

<link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
>

<style>
:root {
    --bg: #0b0b0c;
    --surface: #111214;
    --surface-2: #151618;
    --surface-3: #1a1b1e;
    --border: #27282b;

    --text: #f4f4f5;
    --muted: #92949a;
    --muted-2: #66686e;

    --accent: #ff6b1a;
    --accent-hover: #ff7d36;

    --green: #35c978;
    --red: #ef5b63;

    --radius: 14px;
    --container: 1240px;
}

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, sans-serif;
    -webkit-font-smoothing: antialiased;
}

body::selection {
    background: var(--accent);
    color: white;
}

a {
    color: inherit;
    text-decoration: none;
}

button,
input {
    font: inherit;
}

.container {
    width: min(calc(100% - 40px), var(--container));
    margin-inline: auto;
}

/* =========================
   NAVBAR
========================= */

.navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 72px;

    background: rgba(11, 11, 12, .92);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid rgba(255,255,255,.06);
}

.nav-inner {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.brand {
    display: flex;
    align-items: center;
    gap: 11px;
}

.brand-logo {
    width: 35px;
    height: 35px;
    display: grid;
    place-items: center;

    border-radius: 9px;
    background: var(--accent);
    color: #111;

    font-size: 16px;
}

.brand-name {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -.2px;
}

.brand-sub {
    color: var(--muted-2);
    font-size: 10px;
    margin-top: 2px;
}

.nav-links {
    display: flex;
    align-items: center;
    gap: 27px;
}

.nav-link {
    color: #aaa;
    font-size: 13px;
    transition: .2s ease;
}

.nav-link:hover {
    color: white;
}

.nav-admin {
    display: flex;
    align-items: center;
    gap: 7px;

    padding: 9px 13px;
    border: 1px solid var(--border);
    border-radius: 8px;

    color: #bbb;
    font-size: 12px;

    transition: .2s ease;
}

.nav-admin:hover {
    color: white;
    border-color: #3a3b3e;
    background: #151619;
}

/* =========================
   HERO
========================= */

.hero {
    position: relative;
    overflow: hidden;

    padding: 105px 0 75px;
    border-bottom: 1px solid rgba(255,255,255,.05);
}

.hero::before {
    content: "";
    position: absolute;
    width: 520px;
    height: 520px;

    right: -170px;
    top: -230px;

    background: rgba(255,107,26,.07);
    filter: blur(100px);
    border-radius: 50%;
    pointer-events: none;
}

.hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(300px, .7fr);
    gap: 80px;
    align-items: center;
}

.hero-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .5px;
    text-transform: uppercase;

    margin-bottom: 20px;
}

.hero-label i {
    color: var(--accent);
    font-size: 9px;
}

.hero h1 {
    margin: 0;

    max-width: 780px;

    font-family: "Space Grotesk", sans-serif;
    font-size: clamp(45px, 6vw, 78px);
    line-height: .98;
    letter-spacing: -4px;
    font-weight: 700;
}

.hero h1 span {
    display: block;
    color: #77797f;
}

.hero-desc {
    max-width: 620px;

    margin: 25px 0 0;

    color: #999ba1;
    font-size: 15px;
    line-height: 1.8;
}

.hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 30px;
}

.btn {
    min-height: 44px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;

    padding: 0 17px;

    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;

    transition: .2s ease;
}

.btn-primary {
    background: var(--accent);
    color: #111;
}

.btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
}

.btn-outline {
    border: 1px solid var(--border);
    color: #ddd;
}

.btn-outline:hover {
    border-color: #3a3b3f;
    background: #151619;
}

.hero-side {
    border-left: 1px solid var(--border);
    padding-left: 35px;
}

.hero-side-title {
    font-family: "Space Grotesk", sans-serif;
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 10px;
}

.hero-side-text {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
}

.hero-location {
    margin-top: 25px;
    padding-top: 20px;
    border-top: 1px solid var(--border);

    color: #999;
    font-size: 12px;
    line-height: 1.6;
}

.hero-location a:hover {
    color: var(--accent);
}

/* =========================
   QUICK STATS
========================= */

.quick-info {
    border-bottom: 1px solid var(--border);
}

.quick-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
}

.quick-item {
    min-height: 95px;

    display: flex;
    align-items: center;
    gap: 14px;

    border-right: 1px solid var(--border);
}

.quick-item:first-child {
    padding-left: 0;
}

.quick-item:not(:first-child) {
    padding-left: 28px;
}

.quick-item:last-child {
    border-right: 0;
}

.quick-icon {
    width: 36px;
    height: 36px;

    display: grid;
    place-items: center;

    border-radius: 8px;
    background: var(--surface-2);
    color: var(--accent);

    font-size: 13px;
}

.quick-number {
    font-family: "Space Grotesk", sans-serif;
    font-size: 21px;
    font-weight: 700;
}

.quick-label {
    margin-top: 2px;
    color: var(--muted-2);
    font-size: 11px;
}

/* =========================
   PRODUCT SECTION
========================= */

.section {
    padding: 75px 0;
}

.section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 25px;

    margin-bottom: 25px;
}

.section-kicker {
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;

    margin-bottom: 7px;
}

.section-title {
    margin: 0;

    font-family: "Space Grotesk", sans-serif;
    font-size: 30px;
    letter-spacing: -1.2px;
}

.section-desc {
    margin: 7px 0 0;

    color: var(--muted);
    font-size: 13px;
}

/* SEARCH */

.catalog-toolbar {
    margin-bottom: 13px;
}

.search-box {
    position: relative;
}

.search-box i {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);

    color: var(--muted-2);
    font-size: 13px;
}

.search-box input {
    width: 100%;
    height: 46px;

    padding: 0 15px 0 42px;

    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 9px;

    color: white;
    outline: none;

    font-size: 13px;

    transition: .2s ease;
}

.search-box input::placeholder {
    color: #62646a;
}

.search-box input:focus {
    border-color: rgba(255,107,26,.55);
}

/* CATEGORIES */

.category-list {
    display: flex;
    gap: 7px;

    overflow-x: auto;
    scrollbar-width: none;

    padding-bottom: 5px;
}

.category-list::-webkit-scrollbar {
    display: none;
}

.category-btn {
    flex: 0 0 auto;

    height: 34px;

    padding: 0 13px;

    border: 1px solid var(--border);
    border-radius: 7px;

    background: transparent;
    color: #888;

    cursor: pointer;
    font-size: 11px;
    font-weight: 600;

    transition: .2s ease;
}

.category-btn:hover {
    color: #ddd;
    border-color: #3b3c40;
}

.category-btn.active {
    background: var(--accent);
    color: #111;
    border-color: var(--accent);
}

/* PRODUCTS */

.product-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
}

.product-card {
    min-width: 0;

    overflow: hidden;

    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);

    transition:
        transform .22s ease,
        border-color .22s ease,
        background .22s ease;
}

.product-card:hover {
    transform: translateY(-3px);
    border-color: #37383c;
    background: #131416;
}

.product-image {
    position: relative;

    height: 215px;

    display: grid;
    place-items: center;

    background:
        radial-gradient(
            circle at 50% 50%,
            #202125 0,
            #151619 48%,
            #111214 100%
        );

    border-bottom: 1px solid var(--border);
}

.product-image img {
    width: 100%;
    height: 100%;

    object-fit: contain;

    padding: 22px;

    transition: transform .3s ease;
}

.product-card:hover .product-image img {
    transform: scale(1.035);
}

.no-image {
    color: #34363a;
    font-size: 43px;
}

.product-badge {
    position: absolute;
    z-index: 2;

    top: 11px;
    left: 11px;

    padding: 5px 8px;

    border-radius: 6px;

    font-size: 9px;
    font-weight: 700;
}

.badge-flash {
    background: var(--accent);
    color: #111;
}

.product-status {
    position: absolute;
    z-index: 2;

    top: 11px;
    right: 11px;

    padding: 5px 8px;

    border-radius: 6px;

    background: rgba(0,0,0,.65);
    backdrop-filter: blur(8px);

    font-size: 9px;
    font-weight: 600;
}

.product-status.ready,
.product-status.success {
    color: var(--green);
}

.product-status.empty,
.product-status.out {
    color: var(--red);
}

.product-body {
    padding: 15px;
}

.product-category {
    color: var(--accent);

    font-size: 9px;
    font-weight: 700;
    letter-spacing: .6px;
    text-transform: uppercase;
}

.product-name {
    min-height: 42px;

    margin: 6px 0 7px;

    font-family: "Space Grotesk", sans-serif;
    font-size: 15px;
    line-height: 1.35;

    letter-spacing: -.3px;
}

.product-description {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;

    min-height: 34px;

    margin: 0;

    color: #777980;
    font-size: 11px;
    line-height: 1.55;
}

.product-price {
    margin-top: 14px;

    color: white;

    font-family: "Space Grotesk", sans-serif;
    font-size: 17px;
    font-weight: 700;
}

.product-stock {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    margin-top: 8px;

    color: #696b71;
    font-size: 9px;
}

.product-stock i {
    margin-right: 4px;
}

.product-actions {
    display: grid;
    grid-template-columns: 1fr 38px;

    gap: 7px;

    margin-top: 14px;
}

.buy-btn,
.detail-btn {
    height: 38px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 8px;

    font-size: 11px;
    font-weight: 700;

    transition: .2s ease;
}

.buy-btn {
    background: #e9e9e9;
    color: #111;
}

.buy-btn:hover {
    background: white;
}

.buy-btn.disabled {
    background: #202124;
    color: #5c5e63;
    cursor: not-allowed;
}

.detail-btn {
    border: 1px solid var(--border);

    background: transparent;
    color: #999;

    cursor: pointer;
}

.detail-btn:hover {
    color: white;
    border-color: #3b3c40;
}

.empty {
    display: none;

    text-align: center;
    padding: 80px 20px;

    color: var(--muted);
}

.empty.show {
    display: block;
}

.empty i {
    font-size: 35px;
    color: #383a3e;
}

.empty h3 {
    margin: 15px 0 5px;
    color: #bbb;
}

.empty p {
    margin: 0;
    font-size: 12px;
}

/* =========================
   ABOUT / CONTACT
========================= */

.about-section {
    border-top: 1px solid var(--border);
}

.about-grid {
    display: grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 80px;
}

.about-title {
    margin: 0;

    font-family: "Space Grotesk", sans-serif;
    font-size: 34px;
    letter-spacing: -1.4px;
}

.about-text {
    max-width: 680px;

    margin-top: 17px;

    color: var(--muted);
    font-size: 13px;
    line-height: 1.8;
}

.contact-list {
    border-top: 1px solid var(--border);
}

.contact-item {
    display: flex;
    align-items: center;
    gap: 12px;

    padding: 14px 0;

    border-bottom: 1px solid var(--border);

    color: #999;
    font-size: 12px;

    transition: .2s ease;
}

.contact-item i {
    width: 20px;
    color: var(--accent);
}

.contact-item:hover {
    color: white;
}

/* =========================
   FOOTER
========================= */

.footer {
    padding: 25px 0;

    border-top: 1px solid var(--border);

    color: #5f6166;
    font-size: 10px;
}

.footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
}

.socials {
    display: flex;
    gap: 7px;
}

.social {
    width: 31px;
    height: 31px;

    display: grid;
    place-items: center;

    border: 1px solid var(--border);
    border-radius: 7px;

    color: #777;

    transition: .2s ease;
}

.social:hover {
    color: white;
    border-color: #3b3c40;
}

/* =========================
   FLOAT WHATSAPP
========================= */

.float-wa {
    position: fixed;
    z-index: 90;

    right: 22px;
    bottom: 22px;

    width: 48px;
    height: 48px;

    display: grid;
    place-items: center;

    border-radius: 50%;

    background: #25d366;
    color: white;

    box-shadow: 0 8px 30px rgba(0,0,0,.35);

    font-size: 21px;

    transition: .2s ease;
}

.float-wa:hover {
    transform: translateY(-3px);
}

/* =========================
   MODAL
========================= */

.modal {
    position: fixed;
    z-index: 200;

    inset: 0;

    display: none;
    align-items: center;
    justify-content: center;

    padding: 20px;

    background: rgba(0,0,0,.72);
    backdrop-filter: blur(12px);
}

.modal.show {
    display: flex;
}

.modal-box {
    width: min(560px, 100%);
    max-height: 90vh;
    overflow: auto;

    background: #111214;
    border: 1px solid #2c2d31;
    border-radius: 15px;

    box-shadow: 0 30px 100px rgba(0,0,0,.55);
}

.modal-head {
    height: 58px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 17px;

    border-bottom: 1px solid var(--border);
}

.modal-title {
    font-family: "Space Grotesk", sans-serif;
    font-size: 14px;
    font-weight: 600;
}

.modal-close {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border: 0;
    border-radius: 7px;

    background: #1b1c1f;
    color: #999;

    cursor: pointer;
}

.modal-close:hover {
    color: white;
}

.modal-content {
    padding: 18px;
}

.modal-product-image {
    width: 100%;
    height: 280px;

    object-fit: contain;

    display: block;

    background: #161719;
    border-radius: 10px;

    margin-bottom: 18px;
}

.modal-product-name {
    margin-top: 6px;

    font-family: "Space Grotesk", sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -.7px;
}

.modal-product-price {
    margin-top: 9px;

    color: var(--accent);

    font-family: "Space Grotesk", sans-serif;
    font-size: 19px;
    font-weight: 700;
}

.modal-product-desc {
    margin-top: 15px;

    color: #999ba0;
    font-size: 12px;
    line-height: 1.75;
}

/* =========================
   RESPONSIVE
========================= */

@media (max-width: 1050px) {
    .product-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .hero-grid {
        gap: 45px;
    }
}

@media (max-width: 800px) {
    .nav-links {
        gap: 14px;
    }

    .nav-link {
        display: none;
    }

    .hero {
        padding: 75px 0 60px;
    }

    .hero-grid {
        grid-template-columns: 1fr;
        gap: 40px;
    }

    .hero-side {
        border-left: 0;
        border-top: 1px solid var(--border);
        padding: 25px 0 0;
    }

    .quick-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .quick-item {
        border-bottom: 1px solid var(--border);
    }

    .quick-item:nth-child(2) {
        border-right: 0;
    }

    .quick-item:nth-child(3) {
        padding-left: 0;
    }

    .quick-item:nth-child(4) {
        border-right: 0;
    }

    .product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .about-grid {
        grid-template-columns: 1fr;
        gap: 40px;
    }
}

@media (max-width: 520px) {
    .container {
        width: min(calc(100% - 28px), var(--container));
    }

    .navbar {
        height: 64px;
    }

    .brand-sub {
        display: none;
    }

    .nav-admin span {
        display: none;
    }

    .hero {
        padding: 62px 0 50px;
    }

    .hero h1 {
        font-size: 43px;
        letter-spacing: -2.5px;
    }

    .hero-desc {
        font-size: 13px;
        line-height: 1.7;
    }

    .quick-item {
        min-height: 82px;
    }

    .quick-item:not(:first-child) {
        padding-left: 14px;
    }

    .quick-icon {
        width: 31px;
        height: 31px;
    }

    .quick-number {
        font-size: 17px;
    }

    .section {
        padding: 55px 0;
    }

    .section-title {
        font-size: 26px;
    }

    .product-grid {
        gap: 9px;
    }

    .product-image {
        height: 165px;
    }

    .product-image img {
        padding: 15px;
    }

    .product-body {
        padding: 12px;
    }

    .product-name {
        font-size: 13px;
        min-height: 36px;
    }

    .product-description {
        font-size: 10px;
    }

    .product-price {
        font-size: 15px;
    }

    .buy-btn,
    .detail-btn {
        height: 35px;
        font-size: 10px;
    }

    .buy-btn {
        padding: 0 5px;
    }

    .float-wa {
        right: 16px;
        bottom: 16px;
        width: 45px;
        height: 45px;
    }

    .footer-inner {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
</head>

<body>

<header class="navbar">
    <div class="container nav-inner">

        <a href="index.php" class="brand">
            <div class="brand-logo">
                <i class="fa-solid fa-microchip"></i>
            </div>

            <div>
                <div class="brand-name"><?= h($storeName) ?></div>
                <div class="brand-sub">Computer Store & IT Solution</div>
            </div>
        </a>

        <nav class="nav-links">
            <a href="#produk" class="nav-link">Produk</a>
            <a href="#tentang" class="nav-link">Tentang</a>
            <a href="#kontak" class="nav-link">Kontak</a>

            <a
                href="login.php"
                class="nav-admin"
                title="Login Admin"
            >
                <i class="fa-solid fa-user-shield"></i>
                <span>Admin</span>
            </a>
        </nav>

    </div>
</header>

<main>

<!-- HERO -->
<section class="hero">
    <div class="container">

        <div class="hero-grid">

            <div>

                <div class="hero-label">
                    <i class="fa-solid fa-circle"></i>
                    COMPUTER STORE & IT SOLUTION
                </div>

                <h1>
                    Upgrade
                    <span>Your Digital Life.</span>
                </h1>

                <p class="hero-desc">
                    <?= h($bio) ?>
                    Temukan laptop, PC, monitor, printer, networking
                    dan kebutuhan komputer lainnya di
                    <?= h($storeName) ?>.
                </p>

                <div class="hero-actions">

                    <a href="#produk" class="btn btn-primary">
                        <i class="fa-solid fa-arrow-down"></i>
                        Lihat Produk
                    </a>

                    <?php if ($wa): ?>
                        <a
                            href="<?= h($generalWa) ?>"
                            target="_blank"
                            rel="noopener"
                            class="btn btn-outline"
                        >
                            <i class="fa-brands fa-whatsapp"></i>
                            WhatsApp
                        </a>
                    <?php endif; ?>

                </div>

            </div>

            <div class="hero-side">

                <div class="hero-side-title">
                    Kebutuhan IT, satu tempat.
                </div>

                <div class="hero-side-text">
                    Dari perangkat baru sampai kebutuhan upgrade,
                    maintenance dan networking. Pilih produk yang
                    tersedia lalu hubungi kami untuk pengecekan.
                </div>

                <?php if ($S['address']): ?>
                    <div class="hero-location">
                        <i class="fa-solid fa-location-dot"></i>
                        <a
                            href="<?= h(maps_url($S['address'])) ?>"
                            target="_blank"
                            rel="noopener"
                        >
                            <?= h($S['address']) ?>
                        </a>
                    </div>
                <?php endif; ?>

            </div>

        </div>

    </div>
</section>


<!-- QUICK INFO -->
<section class="quick-info">
    <div class="container">

        <div class="quick-grid">

            <div class="quick-item">
                <div class="quick-icon">
                    <i class="fa-solid fa-box"></i>
                </div>

                <div>
                    <div class="quick-number">
                        <?= count($products) ?>
                    </div>
                    <div class="quick-label">
                        Produk
                    </div>
                </div>
            </div>


            <div class="quick-item">
                <div class="quick-icon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>

                <div>
                    <div class="quick-number">
                        <?= $totalReady ?>
                    </div>
                    <div class="quick-label">
                        Ready Stock
                    </div>
                </div>
            </div>


            <div class="quick-item">
                <div class="quick-icon">
                    <i class="fa-solid fa-bolt"></i>
                </div>

                <div>
                    <div class="quick-number">
                        <?= $totalFlash ?>
                    </div>
                    <div class="quick-label">
                        Flash Sale
                    </div>
                </div>
            </div>


            <div class="quick-item">
                <div class="quick-icon">
                    <i class="fa-solid fa-boxes-stacked"></i>
                </div>

                <div>
                    <div class="quick-number">
                        <?= $totalLimited ?>
                    </div>
                    <div class="quick-label">
                        Stok Terbatas
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>


<!-- PRODUK -->
<section class="section" id="produk">

    <div class="container">

        <div class="section-head">

            <div>
                <div class="section-kicker">
                    CATALOG
                </div>

                <h2 class="section-title">
                    Produk
                </h2>

                <p class="section-desc">
                    Cari perangkat dan kebutuhan IT yang kamu perlukan.
                </p>
            </div>

        </div>


        <div class="catalog-toolbar">

            <div class="search-box">

                <i class="fa-solid fa-magnifying-glass"></i>

                <input
                    type="search"
                    id="search-input"
                    placeholder="Cari produk, brand, SKU..."
                    autocomplete="off"
                >

            </div>

        </div>


        <div class="category-list" id="category-list">

            <button
                type="button"
                class="category-btn active"
                data-cat="all"
            >
                Semua
            </button>

            <?php foreach (CATEGORIES as $c): ?>

                <button
                    type="button"
                    class="category-btn"
                    data-cat="<?= h(strtolower($c)) ?>"
                >
                    <?= h($c) ?>
                </button>

            <?php endforeach; ?>

        </div>


        <div
            class="product-grid"
            id="product-grid"
            style="margin-top:18px"
        >

            <?php foreach ($products as $p): ?>

                <article
                    class="product-card"
                    data-cat="<?= h(strtolower($p['category'])) ?>"
                    data-search="<?= h($p['search']) ?>"
                >

                    <div class="product-image">

                        <?php if ($p['flash']): ?>

                            <div class="product-badge badge-flash">
                                <i class="fa-solid fa-bolt"></i>
                                Flash Sale
                            </div>

                        <?php endif; ?>


                        <div
                            class="product-status <?= h($p['statusClass']) ?>"
                        >
                            <i class="fa-solid <?= h($p['statusIcon']) ?>"></i>
                            <?= h($p['statusLabel']) ?>
                        </div>


                        <?php if ($p['image']): ?>

                            <img
                                src="<?= h($p['image']) ?>"
                                alt="<?= h($p['name']) ?>"
                                loading="lazy"
                                onerror="
                                    this.style.display='none';
                                    this.parentElement.querySelector('.fallback-image').style.display='grid';
                                "
                            >

                            <div
                                class="no-image fallback-image"
                                style="display:none"
                            >
                                <i class="fa-solid fa-image"></i>
                            </div>

                        <?php else: ?>

                            <div class="no-image">
                                <i class="fa-solid fa-computer"></i>
                            </div>

                        <?php endif; ?>

                    </div>


                    <div class="product-body">

                        <div class="product-category">
                            <?= h($p['category']) ?>
                        </div>


                        <h3 class="product-name">
                            <?= h($p['name']) ?>
                        </h3>


                        <p class="product-description">
                            <?= h($p['description']) ?>
                        </p>


                        <div class="product-price">
                            <?= h($p['priceText']) ?>
                        </div>


                        <div class="product-stock">

                            <span>
                                <i class="fa-solid fa-box"></i>
                                Stok <?= (int) $p['stock'] ?>
                            </span>

                            <?php if ($p['sku']): ?>

                                <span>
                                    <?= h($p['sku']) ?>
                                </span>

                            <?php endif; ?>

                        </div>


                        <div class="product-actions">

                            <?php if (
                                $p['stock'] > 0 &&
                                $p['waHref'] !== '#'
                            ): ?>

                                <a
                                    href="<?= h($p['waHref']) ?>"
                                    target="_blank"
                                    rel="noopener"
                                    class="buy-btn"
                                    onclick="gtNotify(
                                        'wa',
                                        '<?= h(addslashes($p['name'])) ?>',
                                        '<?= h(addslashes($p['priceText'])) ?>',
                                        '<?= h(addslashes($p['sku'])) ?>'
                                    )"
                                >
                                    <i class="fa-brands fa-whatsapp"></i>
                                    Tanya
                                </a>

                            <?php else: ?>

                                <a
                                    href="#"
                                    class="buy-btn disabled"
                                    onclick="return false"
                                >
                                    Stok Habis
                                </a>

                            <?php endif; ?>


                            <button
                                type="button"
                                class="detail-btn"
                                title="Detail produk"
                                onclick='gtShowDetail(
                                    <?= json_encode(
                                        $p,
                                        JSON_UNESCAPED_SLASHES |
                                        JSON_UNESCAPED_UNICODE
                                    ) ?>
                                )'
                            >
                                <i class="fa-solid fa-eye"></i>
                            </button>

                        </div>

                    </div>

                </article>

            <?php endforeach; ?>

        </div>


        <div class="empty" id="empty-state">

            <i class="fa-solid fa-box-open"></i>

            <h3>
                Produk tidak ditemukan
            </h3>

            <p>
                Coba kata pencarian lain atau pilih kategori berbeda.
            </p>

        </div>

    </div>

</section>


<!-- TENTANG -->
<section class="section about-section" id="tentang">

    <div class="container">

        <div class="about-grid">

            <div>

                <div class="section-kicker">
                    ABOUT US
                </div>

                <h2 class="about-title">
                    Solusi perangkat IT
                    untuk kebutuhan sehari-hari.
                </h2>

                <p class="about-text">
                    <?= h($bio) ?>
                    Kami menyediakan berbagai kebutuhan komputer dan
                    perangkat IT mulai dari laptop, PC, monitor,
                    printer, sparepart, networking hingga CCTV.
                </p>

            </div>


            <div class="contact-list">

                <?php foreach (
                    [$S['address'], $S['address2']]
                    as $addr
                ): ?>

                    <?php if (!$addr) continue; ?>

                    <a
                        href="<?= h(maps_url($addr)) ?>"
                        target="_blank"
                        rel="noopener"
                        class="contact-item"
                    >
                        <i class="fa-solid fa-location-dot"></i>
                        <span><?= h($addr) ?></span>
                    </a>

                <?php endforeach; ?>


                <?php if ($S['email']): ?>

                    <a
                        href="mailto:<?= h($S['email']) ?>"
                        class="contact-item"
                    >
                        <i class="fa-solid fa-envelope"></i>
                        <span><?= h($S['email']) ?></span>
                    </a>

                <?php endif; ?>


                <?php if ($wa): ?>

                    <a
                        href="<?= h($generalWa) ?>"
                        target="_blank"
                        rel="noopener"
                        class="contact-item"
                    >
                        <i class="fa-brands fa-whatsapp"></i>
                        <span>WhatsApp</span>
                    </a>

                <?php endif; ?>

            </div>

        </div>

    </div>

</section>


<!-- KONTAK -->
<section class="section" id="kontak">

    <div class="container">

        <div class="section-head">

            <div>

                <div class="section-kicker">
                    CONTACT
                </div>

                <h2 class="section-title">
                    Hubungi kami.
                </h2>

                <p class="section-desc">
                    Mau cek stok atau konsultasi kebutuhan IT?
                </p>

            </div>

        </div>


        <div class="hero-actions">

            <?php if ($wa): ?>

                <a
                    href="<?= h($generalWa) ?>"
                    target="_blank"
                    rel="noopener"
                    class="btn btn-primary"
                >
                    <i class="fa-brands fa-whatsapp"></i>
                    WhatsApp
                </a>

            <?php endif; ?>


            <?php if ($S['email']): ?>

                <a
                    href="mailto:<?= h($S['email']) ?>"
                    class="btn btn-outline"
                >
                    <i class="fa-solid fa-envelope"></i>
                    Email
                </a>

            <?php endif; ?>

        </div>

    </div>

</section>

</main>


<!-- FOOTER -->
<footer class="footer">

    <div class="container footer-inner">

        <div>
            © <?= date('Y') ?>
            <?= h($storeName) ?>.
            All rights reserved.
        </div>


        <div class="socials">

            <?php if ($S['instagram']): ?>

                <a
                    href="<?= h($S['instagram']) ?>"
                    target="_blank"
                    rel="noopener"
                    class="social"
                    title="Instagram"
                >
                    <i class="fa-brands fa-instagram"></i>
                </a>

            <?php endif; ?>


            <?php if ($S['facebook']): ?>

                <a
                    href="<?= h($S['facebook']) ?>"
                    target="_blank"
                    rel="noopener"
                    class="social"
                    title="Facebook"
                >
                    <i class="fa-brands fa-facebook"></i>
                </a>

            <?php endif; ?>


            <?php if ($S['tiktok']): ?>

                <a
                    href="<?= h($S['tiktok']) ?>"
                    target="_blank"
                    rel="noopener"
                    class="social"
                    title="TikTok"
                >
                    <i class="fa-brands fa-tiktok"></i>
                </a>

            <?php endif; ?>

        </div>

    </div>

</footer>


<?php if ($wa): ?>

<a
    href="<?= h($generalWa) ?>"
    target="_blank"
    rel="noopener"
    class="float-wa"
    title="Chat WhatsApp"
>
    <i class="fa-brands fa-whatsapp"></i>
</a>

<?php endif; ?>


<!-- MODAL -->
<div class="modal" id="detail-modal">

    <div class="modal-box">

        <div class="modal-head">

            <div class="modal-title">
                Detail Produk
            </div>

            <button
                type="button"
                class="modal-close"
                onclick="gtCloseDetail()"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <div
            class="modal-content"
            id="modal-content"
        ></div>

    </div>

</div>


<script>
/* =========================
   SEARCH & FILTER
========================= */

const searchInput =
    document.getElementById('search-input');

const categoryList =
    document.getElementById('category-list');

const grid =
    document.getElementById('product-grid');

const emptyState =
    document.getElementById('empty-state');

let activeCat = 'all';


function applyFilter() {

    const q =
        searchInput.value
            .trim()
            .toLowerCase();

    let visible = 0;


    grid
        .querySelectorAll('.product-card')
        .forEach(card => {

            const matchCat =
                activeCat === 'all' ||
                card.dataset.cat === activeCat;

            const matchQ =
                q === '' ||
                card.dataset.search.includes(q);

            const show =
                matchCat && matchQ;

            card.style.display =
                show ? '' : 'none';

            if (show) {
                visible++;
            }

        });


    emptyState.classList.toggle(
        'show',
        visible === 0
    );
}


searchInput.addEventListener(
    'input',
    applyFilter
);


categoryList.addEventListener(
    'click',
    e => {

        const btn =
            e.target.closest('.category-btn');

        if (!btn) return;


        categoryList
            .querySelectorAll('.category-btn')
            .forEach(b =>
                b.classList.remove('active')
            );


        btn.classList.add('active');

        activeCat =
            btn.dataset.cat;

        applyFilter();

    }
);


/* =========================
   NOTIFY BACKEND
========================= */

function gtNotify(
    type,
    name,
    price,
    sku
) {

    try {

        const data =
            new FormData();

        data.append('type', type);
        data.append('name', name);
        data.append('price', price);
        data.append('sku', sku);


        navigator.sendBeacon(
            'notify.php',
            data
        );

    } catch (e) {

        // Jangan ganggu proses WhatsApp.

    }
}


/* =========================
   PRODUCT MODAL
========================= */

const modal =
    document.getElementById(
        'detail-modal'
    );

const modalContent =
    document.getElementById(
        'modal-content'
    );


function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}


function gtShowDetail(p) {

    const image = escapeHtml(
        p.image || ''
    );

    const name = escapeHtml(
        p.name || 'Produk'
    );

    const category = escapeHtml(
        p.category || ''
    );

    const price = escapeHtml(
        p.priceText || ''
    );

    const description = escapeHtml(
        p.description || ''
    );

    const sku = escapeHtml(
        p.sku || ''
    );


    modalContent.innerHTML = `

        ${
            image
            ?
            `
            <img
                src="${image}"
                class="modal-product-image"
                alt="${name}"
            >
            `
            :
            `
            <div
                class="modal-product-image"
                style="
                    display:grid;
                    place-items:center;
                    color:#36383c;
                    font-size:55px
                "
            >
                <i class="fa-solid fa-computer"></i>
            </div>
            `
        }


        <div class="product-category">
            ${category}
        </div>


        <div class="modal-product-name">
            ${name}
        </div>


        <div class="modal-product-price">
            ${price}
        </div>


        <div class="modal-product-desc">
            ${description}
        </div>


        <div
            style="
                margin-top:18px;
                color:#777;
                font-size:11px;
                line-height:1.7
            "
        >
            <div>
                <i class="fa-solid fa-box"></i>
                Stok tersedia:
                <strong style="color:white">
                    ${Number(p.stock || 0)}
                </strong>
            </div>

            ${
                sku
                ?
                `
                <div style="margin-top:4px">
                    SKU:
                    <strong style="color:#ccc">
                        ${sku}
                    </strong>
                </div>
                `
                :
                ''
            }
        </div>

    `;


    modal.classList.add('show');

    document.body.style.overflow =
        'hidden';

}


function gtCloseDetail() {

    modal.classList.remove('show');

    document.body.style.overflow =
        '';

}


modal.addEventListener(
    'click',
    e => {

        if (e.target === modal) {
            gtCloseDetail();
        }

    }
);


document.addEventListener(
    'keydown',
    e => {

        if (e.key === 'Escape') {
            gtCloseDetail();
        }

    }
);
</script>

</body>
</html>