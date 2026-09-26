<?php
declare(strict_types=1);

const ROLE_LABEL = [
    'admin' => 'Admin',
    'verified_admin' => 'Verified Admin',
    'super_admin' => 'Super Admin',
];

function rate_limit_ok(string $key, int $limit, int $windowSec): bool
{
    $bucket = $_SESSION['rl'][$key] ?? ['count' => 0, 'reset' => time() + $windowSec];
    if (time() > $bucket['reset']) {
        $bucket = ['count' => 0, 'reset' => time() + $windowSec];
    }
    $bucket['count']++;
    $_SESSION['rl'][$key] = $bucket;
    return $bucket['count'] <= $limit;
}

function current_user(): ?array
{
    if (empty($_SESSION['uid'])) return null;
    foreach (get_users() as $u) {
        if ((int) ($u['id'] ?? 0) === (int) $_SESSION['uid']) {
            if (($u['status'] ?? 'active') !== 'active') return null;
            return $u;
        }
    }
    return null;
}

function require_login(string $path = 'dashboard.php'): array
{
    $u = current_user();
    if (!$u) redirect('login.php?next=' . urlencode($path));
    return $u;
}

/** @param string[] $roles */
function require_role(array $roles, string $path = 'dashboard.php'): array
{
    $u = require_login($path);
    if (!in_array($u['role'] ?? '', $roles, true)) redirect('dashboard.php');
    return $u;
}

function can_manage_products(array $user): bool
{
    return in_array($user['role'] ?? '', ['verified_admin', 'super_admin'], true);
}
function is_super_admin(array $user): bool
{
    return ($user['role'] ?? '') === 'super_admin';
}

function attempt_login(string $username, string $password): array
{
    if (!rate_limit_ok('login', 10, 300)) {
        return ['ok' => false, 'error' => 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.'];
    }

    $users = get_users();

    // Kalau belum ada user sama sekali, buat akun awal (sekali saja).
    if (!$users) {
        $users[] = [
            'id' => 1,
            'username' => 'superadmin',
            'name' => 'Super Administrator',
            'email' => 'admin@geotama.local',
            'password' => password_hash('admin123', PASSWORD_BCRYPT),
            'role' => 'super_admin',
            'verified' => true,
            'status' => 'active',
        ];
        save_users($users);
    }

    $idx = null;
    foreach ($users as $i => $u) {
        if (strcasecmp((string) ($u['username'] ?? ''), $username) === 0) { $idx = $i; break; }
    }
    if ($idx === null) return ['ok' => false, 'error' => 'Username tidak ditemukan.'];

    $u = $users[$idx];
    if (($u['status'] ?? 'active') !== 'active') {
        return ['ok' => false, 'error' => 'Akun kamu sedang tidak aktif.'];
    }

    $stored = (string) ($u['password'] ?? '');
    $valid = false;
    if (str_starts_with($stored, '$2')) {
        $valid = password_verify($password, $stored);
    } elseif ($stored !== '') {
        // Password lama plaintext -> upgrade otomatis ke hash.
        $valid = hash_equals($stored, $password);
        if ($valid) {
            $users[$idx]['password'] = password_hash($password, PASSWORD_BCRYPT);
            save_users($users);
        }
    }
    if (!$valid) return ['ok' => false, 'error' => 'Password yang kamu masukkan salah.'];

    session_regenerate_id(true);
    $_SESSION['uid'] = (int) ($u['id'] ?? $idx + 1);
    return ['ok' => true];
}

function do_logout(): void
{
    $_SESSION = [];
    session_destroy();
}
