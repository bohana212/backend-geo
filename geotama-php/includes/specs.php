<?php
declare(strict_types=1);

const CATEGORIES = [
    'Laptop', 'PC Fullset', 'CPU Only', 'Monitor', 'Aksesoris PC/Laptop',
    'Printer', 'Tinta', 'Networking', 'CCTV',
];

function spec(string $key, string $label, string $icon): array
{
    return ['key' => $key, 'label' => $label, 'icon' => $icon];
}

function specs_table(): array
{
    static $t = null;
    if ($t !== null) return $t;
    $t = [
        'laptop' => [
            spec('cpu', 'Processor', 'fa-solid fa-microchip'), spec('ram', 'RAM', 'fa-solid fa-memory'),
            spec('ssd', 'Storage', 'fa-solid fa-hard-drive'), spec('display', 'Display', 'fa-solid fa-display'),
            spec('os', 'OS', 'fa-brands fa-windows'), spec('gpu', 'GPU', 'fa-solid fa-gamepad'),
        ],
        'pc fullset' => [
            spec('cpu', 'Processor', 'fa-solid fa-microchip'), spec('ram', 'RAM', 'fa-solid fa-memory'),
            spec('ssd', 'Storage', 'fa-solid fa-hard-drive'), spec('vga', 'VGA', 'fa-solid fa-gamepad'),
            spec('monitor', 'Monitor', 'fa-solid fa-display'), spec('psu', 'PSU', 'fa-solid fa-bolt'),
        ],
        'cpu only' => [
            spec('socket', 'Socket', 'fa-solid fa-microchip'), spec('cores', 'Core', 'fa-solid fa-layer-group'),
            spec('threads', 'Thread', 'fa-solid fa-diagram-project'), spec('base_clock', 'Base Clock', 'fa-solid fa-gauge-high'),
            spec('boost_clock', 'Boost Clock', 'fa-solid fa-bolt'), spec('tdp', 'TDP', 'fa-solid fa-temperature-half'),
        ],
        'monitor' => [
            spec('size', 'Ukuran', 'fa-solid fa-expand'), spec('panel', 'Panel', 'fa-solid fa-tv'),
            spec('resolution', 'Resolusi', 'fa-solid fa-maximize'), spec('refresh_rate', 'Refresh Rate', 'fa-solid fa-arrows-rotate'),
            spec('response_time', 'Response Time', 'fa-solid fa-stopwatch'), spec('ports', 'Port', 'fa-solid fa-plug'),
        ],
        'printer' => [
            spec('brand', 'Merk', 'fa-solid fa-copyright'), spec('printer_type', 'Tipe', 'fa-solid fa-print'),
            spec('print_technology', 'Teknologi', 'fa-solid fa-gears'), spec('resolution', 'Resolusi', 'fa-solid fa-maximize'),
            spec('print_speed', 'Kecepatan', 'fa-solid fa-gauge-high'), spec('connectivity', 'Koneksi', 'fa-solid fa-wifi'),
        ],
        'tinta' => [
            spec('ink_type', 'Tipe', 'fa-solid fa-droplet'), spec('color', 'Warna', 'fa-solid fa-palette'),
            spec('capacity', 'Kapasitas', 'fa-solid fa-flask'), spec('compatibility', 'Kompatibilitas', 'fa-solid fa-link'),
            spec('type_code', 'Kode', 'fa-solid fa-barcode'), spec('condition', 'Kondisi', 'fa-solid fa-circle-check'),
        ],
        'networking' => [
            spec('network_type', 'Tipe', 'fa-solid fa-network-wired'), spec('speed', 'Speed', 'fa-solid fa-gauge-high'),
            spec('ports', 'Port', 'fa-solid fa-ethernet'), spec('wifi', 'Wi-Fi', 'fa-solid fa-wifi'),
            spec('antenna', 'Antenna', 'fa-solid fa-satellite-dish'), spec('range', 'Coverage', 'fa-solid fa-tower-broadcast'),
        ],
        'cctv' => [
            spec('resolution', 'Resolusi', 'fa-solid fa-camera'), spec('lens', 'Lens', 'fa-solid fa-eye'),
            spec('night_vision', 'Night Vision', 'fa-solid fa-moon'), spec('storage', 'Storage', 'fa-solid fa-hard-drive'),
            spec('connectivity', 'Koneksi', 'fa-solid fa-wifi'), spec('weatherproof', 'Protection', 'fa-solid fa-cloud-rain'),
        ],
        'aksesoris pc/laptop' => [
            spec('accessory_type', 'Tipe', 'fa-solid fa-toolbox'), spec('connectivity', 'Koneksi', 'fa-solid fa-plug'),
            spec('compatibility', 'Kompatibilitas', 'fa-solid fa-laptop'), spec('interface', 'Interface', 'fa-solid fa-usb'),
            spec('material', 'Material', 'fa-solid fa-cubes'), spec('warranty', 'Garansi', 'fa-solid fa-shield-halved'),
        ],
    ];
    return $t;
}

const LEGACY_SPECS_KEYS = ['brand', 'model', 'vga', 'condition', 'warranty', 'weight'];

function default_specs(): array
{
    return [
        spec('brand', 'Merk', 'fa-solid fa-copyright'), spec('model', 'Model', 'fa-solid fa-tag'),
        spec('condition', 'Kondisi', 'fa-solid fa-circle-check'), spec('warranty', 'Garansi', 'fa-solid fa-shield-halved'),
        spec('weight', 'Berat', 'fa-solid fa-weight-hanging'), spec('connectivity', 'Koneksi', 'fa-solid fa-plug'),
    ];
}

function category_specs(string $category): array
{
    $c = strtolower(trim($category));
    if ($c === 'aksesoris') $c = 'aksesoris pc/laptop';
    $t = specs_table();
    return $t[$c] ?? default_specs();
}
