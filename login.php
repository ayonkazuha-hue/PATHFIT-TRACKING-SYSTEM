<?php
session_start();
require_once 'config.php';

// Already logged in → redirect
if (!empty($_SESSION['user_id'])) {
    header('Location: ' . ($_SESSION['role'] === 'instructor' ? 'instructor_dashboard.php' : 'student_dashboard.php'));
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email    = trim(filter_input(INPUT_POST, 'email',    FILTER_SANITIZE_EMAIL));
    $password = trim(filter_input(INPUT_POST, 'password', FILTER_DEFAULT));

    if ($email && $password) {
        // Authenticate with Supabase Auth
        $auth = supabase_auth('/token?grant_type=password', [
            'email'    => $email,
            'password' => $password,
        ]);

        if ($auth['status'] === 200 && !empty($auth['data']['access_token'])) {
            $jwt    = $auth['data']['access_token'];
            $uid    = $auth['data']['user']['id'];

            // Fetch user profile from users table
            $profile = supabase_authed_request(
                '/rest/v1/users?user_id=eq.' . urlencode($uid) . '&select=*',
                'GET', [], $jwt
            );

            if ($auth['status'] === 200 && !empty($profile['data'][0])) {
                $user = $profile['data'][0];
                $_SESSION['user_id']      = $uid;
                $_SESSION['name']         = $user['name'];
                $_SESSION['email']        = $user['email'];
                $_SESSION['role']         = $user['role'];
                $_SESSION['pathfit_level']= $user['pathfit_level'];
                $_SESSION['jwt']          = $jwt;
                $_SESSION['student_db_id']= $user['user_id'];

                // Check health screening
                $hs = supabase_authed_request(
                    '/rest/v1/health_screening?student_id=eq.' . urlencode($uid) . '&select=screen_id',
                    'GET', [], $jwt
                );
                $hasScreening = !empty($hs['data'][0]);

                if (!$hasScreening && $user['role'] === 'student') {
                    header('Location: health_screening.php');
                } elseif ($user['role'] === 'instructor') {
                    header('Location: instructor_dashboard.php');
                } else {
                    header('Location: student_dashboard.php');
                }
                exit;
            } else {
                $error = 'User profile not found. Please contact your instructor.';
            }
        } else {
            $error = $auth['data']['error_description'] ?? 'Invalid email or password.';
        }
    } else {
        $error = 'Please enter both email and password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT Tracking — Login</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f4f8;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    background: #042C53;
    color: #fff;
    padding: 18px 32px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  header img { height: 44px; }
  header h1 { font-size: 1.4rem; letter-spacing: .5px; }
  header span { font-size: .85rem; opacity: .75; }
  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
  }
  .card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(4,44,83,.12);
    padding: 40px 36px;
    width: 100%;
    max-width: 420px;
  }
  .card h2 {
    color: #042C53;
    font-size: 1.5rem;
    margin-bottom: 6px;
  }
  .card p.sub { color: #555; font-size: .9rem; margin-bottom: 28px; }
  label { display: block; font-size: .88rem; color: #0a0a0a; margin-bottom: 5px; font-weight: 600; }
  input[type=email], input[type=password] {
    width: 100%;
    padding: 11px 14px;
    border: 1.5px solid #cdd5e0;
    border-radius: 7px;
    font-size: .95rem;
    color: #0a0a0a;
    margin-bottom: 18px;
    transition: border-color .2s;
  }
  input:focus { outline: none; border-color: #185FA5; }
  .btn {
    width: 100%;
    padding: 12px;
    background: #185FA5;
    color: #fff;
    border: none;
    border-radius: 7px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background .2s;
  }
  .btn:hover { background: #042C53; }
  .error {
    background: #fde8e8;
    color: #c0392b;
    border: 1px solid #f5c6c6;
    border-radius: 7px;
    padding: 10px 14px;
    font-size: .88rem;
    margin-bottom: 18px;
  }
  .register-link {
    text-align: center;
    margin-top: 20px;
    font-size: .88rem;
    color: #555;
  }
  .register-link a { color: #185FA5; font-weight: 600; text-decoration: none; }
  .register-link a:hover { text-decoration: underline; }
  footer {
    text-align: center;
    padding: 16px;
    font-size: .8rem;
    color: #888;
    background: #fff;
    border-top: 1px solid #e8ecf0;
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>PATHFIT Tracking System</h1>
    <span>Physical Activity Towards Health and Fitness</span>
  </div>
</header>
<main>
  <div class="card">
    <h2>Welcome Back</h2>
    <p class="sub">Sign in to your account to continue.</p>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST" action="login.php">
      <label for="email">Email Address</label>
      <input type="email" id="email" name="email" placeholder="you@school.edu.ph"
             value="<?= htmlspecialchars($_POST['email'] ?? '') ?>" required>

      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="••••••••" required>

      <button type="submit" class="btn">Sign In</button>
    </form>

    <div class="register-link">
      Don't have an account? <a href="register.php">Register here</a>
    </div>
  </div>
</main>
<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
