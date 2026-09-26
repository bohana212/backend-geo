<?php
declare(strict_types=1);

function rupiah($n): string
{
    return 'Rp ' . number_format((float) $n, 0, ',', '.');
}

function wa_number(string $input): string
{
    $n = preg_replace('/\D+/', '', $input) ?? '';
    if ($n === '') return '';
    if ($n[0] === '0') $n = '62' . substr($n, 1);
    return $n;
}

function is_flash($p): bool
{
    foreach ([$p['flash_sale'] ?? null, $p['flash'] ?? null, $p['is_flash_sale'] ?? null] as $v) {
        if ($v === true || $v === 1) return true;
        $s = strtolower(trim((string) $v));
        if ($s === '1' || $s === 'true') return true;
    }
    return false;
}

function product_description(array $p): string
{
    return trim((string) ($p['description'] ?? $p['desc'] ?? ''));
}

function catalog_status(int $stock): array
{
    if ($stock <= 0) return ['label' => 'Stok Habis', 'cls' => 'out', 'icon' => 'fa-circle-xmark'];
    if ($stock <= 3) return ['label' => 'Stok Terbatas', 'cls' => 'low', 'icon' => 'fa-triangle-exclamation'];
    return ['label' => 'Ready Stock', 'cls' => 'ready', 'icon' => 'fa-circle-check'];
}

function admin_status(array $p): string
{
    if (strtoupper(trim((string) ($p['status'] ?? ''))) === 'RESTOCKING') return 'restocking';
    $stock = $p['stock'] ?? null;
    if (is_numeric($stock)) return ((float) $stock) <= 0 ? 'out' : 'ready';
    $t = strtoupper(trim((string) $stock));
    return in_array($t, ['', 'OUT OF STOCK', 'HABIS', 'KOSONG'], true) ? 'out' : 'ready';
}

const STATUS_META = [
    'ready' => ['label' => 'READY STOCK', 'icon' => 'fa-circle-check', 'cls' => 'st-ready'],
    'out' => ['label' => 'OUT OF STOCK', 'icon' => 'fa-box-open', 'cls' => 'st-out'],
    'restocking' => ['label' => 'RESTOCKING', 'icon' => 'fa-arrows-rotate', 'cls' => 'st-restock'],
];

function wib(): string
{
    return date('d-m-Y H:i') . ' WIB';
}

function str_field(string $key, string $default = ''): string
{
    return trim((string) ($_POST[$key] ?? $default));
}
