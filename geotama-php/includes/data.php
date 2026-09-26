<?php
declare(strict_types=1);

/**
 * Penyimpanan data berbasis file JSON di folder data/ (InfinityFree punya
 * disk sungguhan, tidak seperti Vercel yang read-only).
 */

function data_path(string $name): string
{
    return DATA_DIR . '/' . $name . '.json';
}

function data_read(string $name, array $default = []): array
{
    $path = data_path($name);
    if (!file_exists($path)) return $default;
    $raw = file_get_contents($path);
    $json = json_decode($raw, true);
    return is_array($json) ? $json : $default;
}

/** Tulis atomik (tulis ke file sementara lalu rename) supaya file tidak korup kalau ada dua request bersamaan. */
function data_write(string $name, array $value): bool
{
    $path = data_path($name);
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    $ok = file_put_contents($tmp, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    if ($ok === false) return false;
    return rename($tmp, $path);
}

function get_products(): array
{
    $rows = data_read('products', []);
    return array_values(array_filter($rows, 'is_array'));
}
function save_products(array $rows): bool
{
    return data_write('products', array_values($rows));
}

function get_users(): array
{
    $rows = data_read('users', []);
    return array_values(array_filter($rows, 'is_array'));
}
function save_users(array $rows): bool
{
    return data_write('users', array_values($rows));
}

const DEFAULT_SETTINGS = [
    'store_name' => 'GEOTAMA COMPUTER',
    'address' => '',
    'address2' => '',
    'phone' => '',
    'email' => '',
    'contact_admin' => '',
    'bio' => '',
    'profile_image' => '',
    'instagram' => '',
    'facebook' => '',
    'tiktok' => '',
    'whatsapp' => '',
    // Bot Telegram aktif untuk toko ini (dikelola lewat backend Vercel).
    'telegram_bot_id' => '',
    'telegram_bot_name' => '',
    'telegram_api_key' => '',
    'telegram_chat_id' => '',
];

function get_settings(): array
{
    return array_merge(DEFAULT_SETTINGS, data_read('settings', []));
}
function save_settings(array $value): bool
{
    return data_write('settings', array_merge(DEFAULT_SETTINGS, $value));
}
