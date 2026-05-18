<?php


define('SUPABASE_URL', 'https://rurktfddhzhbgafdwnht.supabase.co');
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cmt0ZmRkaHpoYmdhZmR3bmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgyMDYsImV4cCI6MjA5MzY3NDIwNn0.N8Xp_yJnPnTXisapsjMyl6WeIyzJPREn0caYA7JgQD0');
define('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cmt0ZmRkaHpoYmdhZmR3bmh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5ODIwNiwiZXhwIjoyMDkzNjc0MjA2fQ.aU67mq0X2hqaXOpuTm9MV_bu3hO_XhYcltXVcRGFVnA'); // server-side only

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
