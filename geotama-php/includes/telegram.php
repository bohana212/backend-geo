<?php
declare(strict_types=1);

/**
 * Semua panggilan ke backend Telegram (Vercel) terjadi lewat curl di
 * server. Ada dua "kunci" yang berbeda perannya:
 *
 * - TG_MASTER_API_KEY (di config.php)  -> untuk kelola bot: create/list/
 *   update/delete/rotate. Cuma dipakai di setting.php oleh super_admin.
 * - telegram_api_key (di settings.json) -> API key milik SATU bot yang
 *   dipilih jadi "bot aktif" toko ini. Dipakai untuk kirim pesan biasa
 *   (notify.php, error, OTP admin baru).
 */

function tg_backend_request(string $method, string $path, ?array $body = null): array
{
    $url = rtrim(TG_BACKEND_URL, '/') . $path;
    $ch = curl_init($url);
    $headers = ['x-admin-key: ' . TG_MASTER_API_KEY];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
    ];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
    }
    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return [0, ['ok' => false, 'error' => 'Gagal menghubungi backend: ' . $err]];
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    return [$status, is_array($data) ? $data : ['ok' => false, 'error' => 'Respons backend tidak valid.']];
}

function tg_list_bots(): array { return tg_backend_request('GET', '/api/admin/bots'); }

function tg_create_bot(string $name, string $botToken, string $chatId): array
{
    return tg_backend_request('POST', '/api/admin/bots', ['name' => $name, 'botToken' => $botToken, 'chatId' => $chatId]);
}

function tg_update_bot(string $id, array $fields): array
{
    return tg_backend_request('PATCH', '/api/admin/bots/' . rawurlencode($id), $fields);
}

function tg_delete_bot(string $id): array
{
    return tg_backend_request('DELETE', '/api/admin/bots/' . rawurlencode($id));
}

function tg_rotate_key(string $id): array
{
    return tg_backend_request('POST', '/api/admin/bots/' . rawurlencode($id) . '/rotate-key');
}

/** Kirim pesan lewat backend, pakai API key bot (bukan Master Key). */
function tg_send(string $apiKey, string $message, string $chatId = ''): array
{
    $url = rtrim(TG_BACKEND_URL, '/') . '/api/telegram/send';
    $ch = curl_init($url);
    $payload = ['message' => $message];
    if ($chatId !== '') $payload['chatId'] = $chatId;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . $apiKey],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return [0, ['ok' => false, 'error' => 'Gagal menghubungi backend: ' . $err]];
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    return [$status, is_array($data) ? $data : ['ok' => false, 'error' => 'Respons tidak valid.']];
}

/** Escape karakter khusus Markdown Telegram pada teks dinamis. */
function tg_md(string $v): string
{
    return preg_replace('/([_*`\[])/', '\\\\$1', $v) ?? $v;
}

function tg_configured(array $settings): bool
{
    return trim((string) ($settings['telegram_api_key'] ?? '')) !== '';
}

/** Kirim notifikasi memakai bot aktif toko (dari settings.json). */
function tg_notify(string $message, string $chatId = ''): array
{
    $s = get_settings();
    if (!tg_configured($s)) return ['ok' => false, 'error' => 'Bot Telegram belum dihubungkan.'];
    [$status, $data] = tg_send($s['telegram_api_key'], $message, $chatId ?: $s['telegram_chat_id']);
    if ($status === 200 && !empty($data['ok'])) return ['ok' => true];
    $reason = $data['telegram']['description'] ?? ($data['error'] ?? "HTTP $status");
    return ['ok' => false, 'error' => $reason];
}

function tg_notify_server_error(Throwable $e, string $path): void
{
    try {
        $s = get_settings();
        if (!tg_configured($s)) return;
        tg_notify(
            "🚨 *SERVER ERROR - " . tg_md($s['store_name']) . "*\n\n" .
            'Jenis: ' . tg_md(get_class($e)) . "\n" .
            'Pesan: ' . tg_md(mb_substr($e->getMessage(), 0, 300)) . "\n" .
            'Halaman: ' . tg_md($path) . "\n" .
            'Waktu: ' . wib()
        );
    } catch (Throwable) {
        // jangan sampai notifikasi error bikin error baru
    }
}
