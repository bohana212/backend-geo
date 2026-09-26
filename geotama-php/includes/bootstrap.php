<?php
declare(strict_types=1);

$configFile = __DIR__ . '/../config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    exit('config.php belum ada. Salin dari config.example.php lalu isi nilainya.');
}
require_once $configFile;

date_default_timezone_set('Asia/Jakarta');

define('DATA_DIR', __DIR__ . '/../data');

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $secure,
]);
session_name('gt_sess');
session_start();

function h(?string $v): string
{
    return htmlspecialchars($v ?? '', ENT_QUOTES, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    $sent = $_POST['csrf'] ?? '';
    $stored = $_SESSION['csrf'] ?? '';
    if ($stored === '' || !hash_equals($stored, (string) $sent)) {
        http_response_code(403);
        exit('Sesi tidak valid (CSRF). Muat ulang halaman lalu coba lagi.');
    }
}

function flash_set(string $type, string $msg): void
{
    $_SESSION['flash'] = ['type' => $type, 'msg' => $msg];
}

function flash_get(): ?array
{
    if (empty($_SESSION['flash'])) return null;
    $f = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $f;
}

function redirect(string $to): never
{
    header('Location: ' . $to);
    exit;
}

function safe_next(string $next, string $fallback = 'dashboard.php'): string
{
    if ($next === '' || $next[0] !== '/' && !preg_match('~^[a-zA-Z0-9_\-]+\.php~', $next)) {
        return $fallback;
    }
    // Hanya izinkan path relatif di dalam situs ini (cegah open redirect).
    if (str_starts_with($next, '//') || str_contains($next, '://')) return $fallback;
    return $next;
}
