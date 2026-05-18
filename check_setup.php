<?php

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT Setup Checker</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; padding: 40px 20px; }
  .container { max-width: 800px; margin: 0 auto; }
  .card { background: #fff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 24px rgba(4,44,83,.12); margin-bottom: 20px; }
  h1 { color: #042C53; font-size: 1.8rem; margin-bottom: 10px; }
  .subtitle { color: #666; font-size: .95rem; margin-bottom: 30px; }
  .check-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 8px; margin-bottom: 12px; }
  .check-item.pass { background: #e8f5e9; border-left: 4px solid #2e7d32; }
  .check-item.fail { background: #fde8e8; border-left: 4px solid #c62828; }
  .check-item.warn { background: #fff8e1; border-left: 4px solid #f57f17; }
  .icon { font-size: 1.3rem; flex-shrink: 0; }
  .icon.pass { color: #2e7d32; }
  .icon.fail { color: #c62828; }
  .icon.warn { color: #f57f17; }
  .check-content { flex: 1; }
  .check-title { font-weight: 700; font-size: .95rem; margin-bottom: 4px; }
  .check-desc { font-size: .85rem; color: #555; line-height: 1.5; }
  .code { background: #f5f8fc; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: .85rem; }
  .btn { display: inline-block; padding: 12px 24px; background: #185FA5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 10px; }
  .btn:hover { background: #042C53; }
  .summary { display: flex; gap: 20px; margin-bottom: 30px; }
  .stat { flex: 1; text-align: center; padding: 16px; background: #f5f8fc; border-radius: 8px; }
  .stat-value { font-size: 2rem; font-weight: 700; color: #042C53; }
  .stat-label { font-size: .8rem; color: #666; text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h1>🏃‍♂️ PATHFIT Setup Checker</h1>
    <p class="subtitle">Verifying your installation requirements...</p>

    <?php
    $checks = [];
    $passCount = 0;
    $failCount = 0;
    $warnCount = 0;

    // Check 1: PHP Version
    $phpVersion = phpversion();
    $phpOk = version_compare($phpVersion, '7.4.0', '>=');
    $checks[] = [
        'status' => $phpOk ? 'pass' : 'fail',
        'title'  => 'PHP Version',
        'desc'   => $phpOk 
            ? "✓ PHP $phpVersion detected (minimum 7.4 required)"
            : "✗ PHP $phpVersion is too old. Please upgrade to PHP 7.4 or higher."
    ];
    $phpOk ? $passCount++ : $failCount++;

    // Check 2: cURL Extension
    $curlOk = function_exists('curl_init');
    $checks[] = [
        'status' => $curlOk ? 'pass' : 'fail',
        'title'  => 'cURL Extension',
        'desc'   => $curlOk
            ? '✓ cURL extension is enabled'
            : '✗ cURL extension is missing. Enable it in php.ini: extension=curl'
    ];
    $curlOk ? $passCount++ : $failCount++;

    // Check 3: Session Support
    $sessionOk = function_exists('session_start');
    $checks[] = [
        'status' => $sessionOk ? 'pass' : 'fail',
        'title'  => 'Session Support',
        'desc'   => $sessionOk
            ? '✓ PHP sessions are supported'
            : '✗ Session support is missing. Check your PHP installation.'
    ];
    $sessionOk ? $passCount++ : $failCount++;

    // Check 4: config.php exists
    $configExists = file_exists(__DIR__ . '/config.php');
    $checks[] = [
        'status' => $configExists ? 'pass' : 'fail',
        'title'  => 'config.php File',
        'desc'   => $configExists
            ? '✓ config.php file found'
            : '✗ config.php file is missing'
    ];
    $configExists ? $passCount++ : $failCount++;

    // Check 5: Supabase Configuration
    if ($configExists) {
        require_once __DIR__ . '/config.php';
        $supabaseConfigured = 
            defined('SUPABASE_URL') && 
            strpos(SUPABASE_URL, 'YOUR_PROJECT_ID') === false &&
            defined('SUPABASE_ANON_KEY') &&
            strpos(SUPABASE_ANON_KEY, 'YOUR_ANON_KEY') === false;
        
        $checks[] = [
            'status' => $supabaseConfigured ? 'pass' : 'warn',
            'title'  => 'Supabase Configuration',
            'desc'   => $supabaseConfigured
                ? '✓ Supabase credentials are configured in config.php'
                : '⚠ config.php still has placeholder values. Update SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY with your actual credentials.'
        ];
        $supabaseConfigured ? $passCount++ : $warnCount++;
    }

    // Check 6: Required PHP files
    $requiredFiles = [
        'login.php', 'register.php', 'student_dashboard.php', 
        'instructor_dashboard.php', 'fitness_test_entry.php'
    ];
    $allFilesExist = true;
    foreach ($requiredFiles as $file) {
        if (!file_exists(__DIR__ . '/' . $file)) {
            $allFilesExist = false;
            break;
        }
    }
    $checks[] = [
        'status' => $allFilesExist ? 'pass' : 'fail',
        'title'  => 'Required PHP Files',
        'desc'   => $allFilesExist
            ? '✓ All required PHP files are present'
            : '✗ Some PHP files are missing. Re-download the complete package.'
    ];
    $allFilesExist ? $passCount++ : $failCount++;

    // Check 7: Write permissions
    $tempFile = __DIR__ . '/test_write_' . time() . '.tmp';
    $canWrite = @file_put_contents($tempFile, 'test') !== false;
    if ($canWrite) @unlink($tempFile);
    $checks[] = [
        'status' => $canWrite ? 'pass' : 'warn',
        'title'  => 'Directory Permissions',
        'desc'   => $canWrite
            ? '✓ Directory is writable'
            : '⚠ Directory may not be writable. This could cause session issues.'
    ];
    $canWrite ? $passCount++ : $warnCount++;

    // Check 8: JSON Extension
    $jsonOk = function_exists('json_encode');
    $checks[] = [
        'status' => $jsonOk ? 'pass' : 'fail',
        'title'  => 'JSON Extension',
        'desc'   => $jsonOk
            ? '✓ JSON extension is enabled'
            : '✗ JSON extension is missing'
    ];
    $jsonOk ? $passCount++ : $failCount++;

    $totalChecks = count($checks);
    ?>

    <div class="summary">
      <div class="stat">
        <div class="stat-value" style="color:#2e7d32;"><?= $passCount ?></div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#f57f17;"><?= $warnCount ?></div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#c62828;"><?= $failCount ?></div>
        <div class="stat-label">Failed</div>
      </div>
    </div>

    <?php foreach ($checks as $check): ?>
    <div class="check-item <?= $check['status'] ?>">
      <div class="icon <?= $check['status'] ?>">
        <?php
          echo $check['status'] === 'pass' ? '✓' : ($check['status'] === 'fail' ? '✗' : '⚠');
        ?>
      </div>
      <div class="check-content">
        <div class="check-title"><?= htmlspecialchars($check['title']) ?></div>
        <div class="check-desc"><?= $check['desc'] ?></div>
      </div>
    </div>
    <?php endforeach; ?>

    <?php if ($failCount === 0 && $warnCount === 0): ?>
    <div style="text-align:center; margin-top:30px; padding:20px; background:#e8f5e9; border-radius:8px;">
      <h2 style="color:#2e7d32; margin-bottom:10px;">🎉 All checks passed!</h2>
      <p style="color:#555; margin-bottom:16px;">Your PATHFIT system is ready to use.</p>
      <a href="login.php" class="btn">Go to Login Page →</a>
    </div>
    <?php elseif ($failCount === 0): ?>
    <div style="text-align:center; margin-top:30px; padding:20px; background:#fff8e1; border-radius:8px;">
      <h2 style="color:#f57f17; margin-bottom:10px;">⚠ Setup incomplete</h2>
      <p style="color:#555; margin-bottom:16px;">Please address the warnings above before proceeding.</p>
      <a href="INSTALLATION_GUIDE.txt" class="btn">View Installation Guide</a>
    </div>
    <?php else: ?>
    <div style="text-align:center; margin-top:30px; padding:20px; background:#fde8e8; border-radius:8px;">
      <h2 style="color:#c62828; margin-bottom:10px;">❌ Setup failed</h2>
      <p style="color:#555; margin-bottom:16px;">Please fix the errors above before proceeding.</p>
      <a href="INSTALLATION_GUIDE.txt" class="btn">View Installation Guide</a>
    </div>
    <?php endif; ?>
  </div>

  <div class="card" style="font-size:.85rem; color:#666;">
    <strong>Next Steps:</strong>
    <ol style="margin-left:20px; margin-top:10px; line-height:1.8;">
      <li>If you see warnings or errors, check <span class="code">INSTALLATION_GUIDE.txt</span></li>
      <li>Make sure you've run <span class="code">schema.sql</span> in Supabase SQL Editor</li>
      <li>Update <span class="code">config.php</span> with your Supabase credentials</li>
      <li>Create your first instructor account via the registration page</li>
      <li>Change the user's role to "instructor" in Supabase Table Editor</li>
    </ol>
  </div>
</div>
</body>
</html>
