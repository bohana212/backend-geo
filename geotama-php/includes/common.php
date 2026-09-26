<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/data.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/specs.php';
require_once __DIR__ . '/telegram.php';

/** Semua error PHP fatal dikirim ke Telegram (kalau bot aktif sudah ada), lalu ditampilkan sebagai 500 polos. */
set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage());
    tg_notify_server_error($e, $_SERVER['REQUEST_URI'] ?? '');
    http_response_code(500);
    echo 'Terjadi kesalahan pada server. Tim kami sudah diberi tahu.';
});
