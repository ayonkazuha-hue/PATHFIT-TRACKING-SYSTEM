<?php
// ============================================================
// config.php — Supabase credentials & shared helpers
// ============================================================

define('SUPABASE_URL', 'https://YOUR_PROJECT_ID.supabase.co');
define('SUPABASE_ANON_KEY', 'YOUR_ANON_KEY_HERE');
define('SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_ROLE_KEY_HERE'); // server-side only

// ── cURL helper ─────────────────────────────────────────────
function supabase_request(string $endpoint, string $method = 'GET', array $body = [], bool $useService = false): array
{
    $key = $useService ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
    $url = SUPABASE_URL . $endpoint;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
            'Prefer: return=representation',
        ],
    ]);

    if (!empty($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'status' => $httpCode,
        'data'   => json_decode($response, true),
    ];
}

// ── Auth helper (uses Supabase Auth REST) ───────────────────
function supabase_auth(string $endpoint, array $body): array
{
    $url = SUPABASE_URL . '/auth/v1' . $endpoint;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . SUPABASE_ANON_KEY,
            'Content-Type: application/json',
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'status' => $httpCode,
        'data'   => json_decode($response, true),
    ];
}

// ── Authenticated request (uses user JWT) ───────────────────
function supabase_authed_request(string $endpoint, string $method = 'GET', array $body = [], string $jwt = ''): array
{
    $url = SUPABASE_URL . $endpoint;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . SUPABASE_ANON_KEY,
            'Authorization: Bearer ' . $jwt,
            'Content-Type: application/json',
            'Prefer: return=representation',
        ],
    ]);
    if (!empty($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'status' => $httpCode,
        'data'   => json_decode($response, true),
    ];
}

// ── Session guard ────────────────────────────────────────────
function require_login(): void
{
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['user_id'])) {
        header('Location: login.php');
        exit;
    }
}

function require_instructor(): void
{
    require_login();
    if ($_SESSION['role'] !== 'instructor') {
        header('Location: student_dashboard.php');
        exit;
    }
}
