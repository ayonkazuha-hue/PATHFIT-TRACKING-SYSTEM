<?php
session_start();
require_once 'config.php';
require_login();

if ($_SESSION['role'] === 'instructor') {
    header('Location: instructor_dashboard.php');
    exit;
}

$jwt = $_SESSION['jwt'];
$uid = $_SESSION['user_id'];

// Fetch fitness tests
$ftRes = supabase_authed_request(
    '/rest/v1/fitness_tests?student_id=eq.' . urlencode($uid) . '&select=*&order=created_at.desc',
    'GET', [], $jwt
);
$fitnessTests = $ftRes['data'] ?? [];

// Separate pre/post
$preTests  = array_filter($fitnessTests, fn($t) => $t['test_period'] === 'pre');
$postTests = array_filter($fitnessTests, fn($t) => $t['test_period'] === 'post');

// Fetch current week lesson plan
$level = $_SESSION['pathfit_level'] ?? 1;
$currentWeek = min(max(1, (int)date('W') % 16 ?: 16), 16); // rough estimate
$lpRes = supabase_authed_request(
    '/rest/v1/lesson_plans?pathfit_level=eq.' . $level . '&week_number=eq.' . $currentWeek . '&select=*',
    'GET', [], $jwt
);
$lessonPlan = $lpRes['data'][0] ?? null;

// Fetch health screening
$hsRes = supabase_authed_request(
    '/rest/v1/health_screening?student_id=eq.' . urlencode($uid) . '&select=*',
    'GET', [], $jwt
);
$screening = $hsRes['data'][0] ?? null;

// Fetch portfolio
$pfRes = supabase_authed_request(
    '/rest/v1/fitness_portfolio?student_id=eq.' . urlencode($uid) . '&select=*&order=submitted_at.desc',
    'GET', [], $jwt
);
$portfolios = $pfRes['data'] ?? [];

$ratingColors = [
    'excellent'         => '#2e7d32',
    'good'              => '#1565c0',
    'fair'              => '#e65100',
    'needs_improvement' => '#c62828',
];
$testLabels = [
    'push_ups'    => 'Push-Ups',
    'sit_ups'     => 'Sit-Ups',
    'sit_reach'   => 'Sit & Reach',
    'step_test'   => 'Step Test',
    'shuttle_run' => 'Shuttle Run',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Student Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #0a0a0a; }
  header { background: #042C53; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  header .brand h1 { font-size: 1.2rem; }
  header .brand span { font-size: .8rem; opacity: .7; }
  header nav a { color: #fff; text-decoration: none; margin-left: 20px; font-size: .88rem; opacity: .85; }
  header nav a:hover { opacity: 1; text-decoration: underline; }
  .container { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
  .welcome { margin-bottom: 24px; }
  .welcome h2 { font-size: 1.5rem; color: #042C53; }
  .welcome p { color: #555; font-size: .9rem; margin-top: 4px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: #fff; border-radius: 10px; padding: 20px 22px; box-shadow: 0 2px 12px rgba(4,44,83,.08); border-left: 4px solid #185FA5; }
  .stat-card .label { font-size: .78rem; text-transform: uppercase; letter-spacing: .8px; color: #666; margin-bottom: 6px; }
  .stat-card .value { font-size: 1.8rem; font-weight: 700; color: #042C53; }
  .stat-card .sub { font-size: .8rem; color: #888; margin-top: 4px; }
  .stat-card.warning { border-left-color: #e53935; }
  .stat-card.warning .value { color: #e53935; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
  @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 10px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; }
  .bar-label { display: flex; justify-content: space-between; font-size: .82rem; color: #555; margin-top: 5px; }
  .flag-alert { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .85rem; margin-top: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 9px 12px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f0f4f8; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: .78rem; font-weight: 600; color: #fff; }
  .badge-excellent { background: #2e7d32; }
  .badge-good { background: #1565c0; }
  .badge-fair { background: #e65100; }
  .badge-needs_improvement { background: #c62828; }
  .badge-present { background: #2e7d32; }
  .badge-absent { background: #c62828; }
  .badge-excused { background: #e65100; }
  .lesson-card { background: linear-gradient(135deg, #042C53 0%, #185FA5 100%); color: #fff; border-radius: 10px; padding: 22px 24px; margin-bottom: 28px; }
  .lesson-card .week-tag { font-size: .78rem; opacity: .75; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .lesson-card h3 { font-size: 1.15rem; margin-bottom: 8px; }
  .lesson-card p { font-size: .88rem; opacity: .9; line-height: 1.5; }
  .lesson-card .meta { display: flex; gap: 20px; margin-top: 12px; font-size: .82rem; opacity: .8; }
  .btn { display: inline-block; padding: 9px 20px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .88rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .btn-sm { padding: 6px 14px; font-size: .82rem; }
  .empty-state { text-align: center; color: #aaa; padding: 24px 0; font-size: .9rem; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
  .screening-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: .82rem; font-weight: 600; }
  .cleared { background: #e8f5e9; color: #2e7d32; }
  .pending { background: #fff8e1; color: #f57f17; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>PATHFIT Tracking System</h1>
    <span>Student Portal — PATHFit <?= $level ?></span>
  </div>
  <nav>
    <a href="fitness_test_entry.php">Fitness Tests</a>
    <a href="lesson_plans.php">Lesson Plans</a>
    <a href="portfolio.php">Portfolio</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <div class="welcome">
    <h2>Hello, <?= htmlspecialchars($_SESSION['name']) ?> 👋</h2>
    <p>Here's your fitness progress overview for PATHFit <?= $level ?>.</p>
  </div>

  <!-- Stat Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">Fitness Tests Recorded</div>
      <div class="value"><?= count($fitnessTests) ?></div>
      <div class="sub"><?= count($preTests) ?> pre · <?= count($postTests) ?> post</div>
    </div>
    <div class="stat-card">
      <div class="label">Portfolio Submissions</div>
      <div class="value"><?= count($portfolios) ?></div>
      <div class="sub"><?= empty($portfolios) ? 'None submitted yet' : 'Last: ' . date('M j, Y', strtotime($portfolios[0]['submitted_at'])) ?></div>
    </div>
    <div class="stat-card">
      <div class="label">Health Screening</div>
      <div class="value" style="font-size:1rem; margin-top:6px;">
        <?php if ($screening): ?>
          <span class="screening-badge <?= $screening['cleared'] ? 'cleared' : 'pending' ?>">
            <?= $screening['cleared'] ? '✔ Cleared' : '⏳ Pending Clearance' ?>
          </span>
        <?php else: ?>
          <a href="health_screening.php" class="btn btn-sm">Complete Now</a>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <!-- Current Lesson Plan -->
  <?php if ($lessonPlan): ?>
  <div class="lesson-card">
    <div class="week-tag">Week <?= $lessonPlan['week_number'] ?> · PATHFit <?= $level ?></div>
    <h3><?= htmlspecialchars($lessonPlan['topic']) ?></h3>
    <p><?= htmlspecialchars($lessonPlan['objectives']) ?></p>
    <div class="meta">
      <span>📋 <?= htmlspecialchars($lessonPlan['activity']) ?></span>
    </div>
  </div>
  <?php endif; ?>

  <div class="grid-2">
    <!-- Fitness Test Summary -->
    <div class="card">
      <h3>Fitness Test Results</h3>
      <?php if (!empty($fitnessTests)): ?>
      <table>
        <thead><tr><th>Test</th><th>Period</th><th>Score</th><th>Rating</th></tr></thead>
        <tbody>
          <?php foreach (array_slice($fitnessTests, 0, 8) as $t): ?>
          <tr>
            <td><?= $testLabels[$t['test_type']] ?? $t['test_type'] ?></td>
            <td><?= ucfirst($t['test_period']) ?></td>
            <td><?= $t['reps_or_cm'] ?></td>
            <td>
              <?php if ($t['rating']): ?>
                <span class="badge badge-<?= $t['rating'] ?>"><?= ucwords(str_replace('_',' ',$t['rating'])) ?></span>
              <?php else: ?>—<?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <div style="margin-top:12px;">
        <a href="fitness_test_entry.php" class="btn btn-sm">View All / Compare</a>
      </div>
      <?php else: ?>
        <div class="empty-state">No fitness tests recorded yet.</div>
      <?php endif; ?>
    </div>
  </div>

  <!-- Portfolio -->
  <div class="card" style="margin-bottom:28px;">
    <h3>Fitness Portfolio</h3>
    <?php if (!empty($portfolios)): ?>
    <table>
      <thead><tr><th>Semester</th><th>Submitted</th><th>Reflection Preview</th></tr></thead>
      <tbody>
        <?php foreach ($portfolios as $pf): ?>
        <tr>
          <td><?= htmlspecialchars($pf['semester']) ?></td>
          <td><?= date('M j, Y', strtotime($pf['submitted_at'])) ?></td>
          <td><?= htmlspecialchars(substr($pf['reflection_notes'] ?? '', 0, 80)) ?>...</td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php else: ?>
      <div class="empty-state">No portfolio submitted yet.</div>
    <?php endif; ?>
    <div style="margin-top:14px;">
      <a href="portfolio.php" class="btn btn-sm">Submit / View Portfolio</a>
    </div>
  </div>
</div>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
