<?php
require_once __DIR__ . '/includes/common.php';
header('Content-Type: application/json');

/** Rate limit sederhana per-IP, disimpan di file (bukan session, karena sendBeacon dari browser tidak selalu bawa cookie sama). */
function notify_rate_limit_ok(string $ip, int $limit, int $windowSec): bool
{
    $path = DATA_DIR . '/.rl_notify.json';
    $all = [];
    if (file_exists($path)) $all = json_decode(file_get_contents($path), true) ?: [];
    $now = time();
    $bucket = $all[$ip] ?? ['count' => 0, 'reset' => $now + $windowSec];
    if ($now > $bucket['reset']) $bucket = ['count' => 0, 'reset' => $now + $windowSec];
    $bucket['count']++;
    $all[$ip] = $bucket;
    // buang entri lama biar file tidak membengkak
    foreach ($all as $k => $b) if ($now > $b['reset'] + 3600) unset($all[$k]);
    @file_put_contents($path, json_encode($all));
    return $bucket['count'] <= $limit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ip = trim(explode(',', $ip)[0]);
if (!notify_rate_limit_ok($ip, 10, 60)) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'message' => 'Too many requests']);
    exit;
}

$type = mb_substr(trim((string) ($_POST['type'] ?? 'produk')), 0, 30);
$name = mb_substr(trim((string) ($_POST['name'] ?? 'Produk')), 0, 150);
$price = mb_substr(trim((string) ($_POST['price'] ?? '')), 0, 50);
$sku = mb_substr(trim((string) ($_POST['sku'] ?? '')), 0, 50);

$text = "🛒 *Ada aktivitas pembelian!*\n\n" .
    'Produk: ' . tg_md($name) . "\n" .
    ($price !== '' ? 'Harga: ' . tg_md($price) . "\n" : '') .
    ($sku !== '' ? 'SKU: ' . tg_md($sku) . "\n" : '') .
    'Aksi: ' . ($type === 'wa' ? 'Klik tombol Tanya/Pesan WhatsApp' : tg_md($type)) . "\n" .
    'Waktu: ' . wib();

$result = tg_notify($text);
echo json_encode(['ok' => $result['ok']]);
