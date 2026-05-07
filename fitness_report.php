<?php
session_start();
require_once 'config.php';
require_login();

$jwt          = $_SESSION['jwt'];
$isInstructor = $_SESSION['role'] === 'instructor';

// Determine which student to show
if ($isInstructor) {
    $targetId = trim(filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
    if (!$targetId) {
        // Show class-wide summary
        $targetId = null;
    }
} else {
    $targetId = $_SESSION['user_id'];
}

$studentInfo = null;
if ($targetId) {
    $siRes = supabase_authed_request('/rest/v1/users?user_id=eq.' . urlencode($targetId) . '&select=*', 'GET', [], $jwt);
    $studentInfo = $siRes['data'][0] ?? null;
}

// Fetch tests
$testQuery = '/rest/v1/fitness_tests?select=*&order=test_type.asc,test_period.asc';
if ($targetId) $testQuery .= '&student_id=eq.' . urlencode($targetId);
$testsRes = supabase_authed_request($testQuery, 'GET', [], $jwt);
$allTests = $testsRes['data'] ?? [];

// Group by test_type → period
$grouped = [];
foreach ($allTests as $t) {
    $grouped[$t['test_type']][$t['test_period']][] = $t;
}

$testLabels = [
    'push_ups'    => 'Push-Ups',
    'sit_ups'     => 'Sit-Ups',
    'sit_reach'   => 'Sit & Reach (cm)',
    'step_test'   => 'Step Test (bpm)',
    'shuttle_run' => 'Shuttle Run (sec)',
];

$ratingOrder = ['needs_improvement' => 1, 'fair' => 2, 'good' => 3, 'excellent' => 4];

function latestScore(array $records): ?array {
    if (empty($records)) return null;
    usort($records, fn($a,$b) => strtotime($b['created_at']) - strtotime($a['created_at']));
    return $records[0];
}

function improvementArrow(string $pre, string $post): string {
    global $ratingOrder;
    $p = $ratingOrder[$pre] ?? 0;
    $q = $ratingOrder[$post] ?? 0;
    if ($q > $p) return '<span style="color:#2e7d32;font-weight:700;">▲ Improved</span>';
    if ($q < $p) return '<span style="color:#c62828;font-weight:700;">▼ Declined</span>';
    return '<span style="color:#888;">— Same</span>';
}

// Fetch students list for instructor dropdown
$studentsList = [];
if ($isInstructor) {
    $slRes = supabase_authed_request('/rest/v1/users?role=eq.student&select=user_id,name,section&order=name.asc', 'GET', [], $jwt);
    $studentsList = $slRes['data'] ?? [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Pre/Post Fitness Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #0a0a0a; }
  header { background: #042C53; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  header h1 { font-size: 1.2rem; }
  header nav a { color: #fff; text-decoration: none; margin-left: 18px; font-size: .88rem; opacity: .85; }
  header nav a:hover { opacity: 1; text-decoration: underline; }
  .container { max-width: 1000px; margin: 0 auto; padding: 28px 20px; }
  .page-title { font-size: 1.4rem; color: #042C53; margin-bottom: 4px; }
  .page-sub { color: #555; font-size: .9rem; margin-bottom: 24px; }
  .card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); margin-bottom: 24px; }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; }
  .student-selector { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 24px; }
  .student-selector label { font-size: .85rem; font-weight: 600; color: #042C53; display: block; margin-bottom: 4px; }
  .student-selector select { padding: 9px 13px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .9rem; min-width: 260px; }
  .student-selector select:focus { outline: none; border-color: #185FA5; }
  .btn { display: inline-block; padding: 9px 18px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .88rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .student-info-bar { background: linear-gradient(135deg, #042C53, #185FA5); color: #fff; border-radius: 10px; padding: 16px 22px; margin-bottom: 24px; display: flex; gap: 30px; flex-wrap: wrap; }
  .student-info-bar .info-item .label { font-size: .75rem; opacity: .75; text-transform: uppercase; letter-spacing: .8px; }
  .student-info-bar .info-item .val { font-size: 1rem; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: .75rem; font-weight: 600; color: #fff; }
  .badge-excellent { background: #2e7d32; }
  .badge-good { background: #1565c0; }
  .badge-fair { background: #e65100; }
  .badge-needs_improvement { background: #c62828; }
  .score-diff { font-size: .82rem; }
  .score-diff.up { color: #2e7d32; font-weight: 700; }
  .score-diff.down { color: #c62828; font-weight: 700; }
  .empty-state { text-align: center; color: #aaa; padding: 32px 0; font-size: .9rem; }
  .back-link { display: inline-block; margin-bottom: 16px; color: #185FA5; text-decoration: none; font-size: .88rem; }
  .back-link:hover { text-decoration: underline; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
  .no-data { color: #bbb; font-style: italic; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Pre/Post Fitness Report</h1>
  <nav>
    <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>">Dashboard</a>
    <a href="fitness_test_entry.php">Record Tests</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>" class="back-link">← Back to Dashboard</a>
  <div class="page-title">Pre vs. Post Fitness Comparison</div>
  <div class="page-sub">Compare baseline and end-of-semester fitness test results to measure student progress.</div>

  <?php if ($isInstructor): ?>
  <form method="GET" action="fitness_report.php">
    <div class="student-selector">
      <div>
        <label for="student_id">Select Student</label>
        <select id="student_id" name="student_id">
          <option value="">— Class-Wide Summary —</option>
          <?php foreach ($studentsList as $s): ?>
            <option value="<?= htmlspecialchars($s['user_id']) ?>"
                    <?= $targetId === $s['user_id'] ? 'selected' : '' ?>>
              <?= htmlspecialchars($s['name']) ?> (<?= htmlspecialchars($s['section'] ?? '') ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <button type="submit" class="btn">View Report</button>
    </div>
  </form>
  <?php endif; ?>

  <?php if ($studentInfo): ?>
  <div class="student-info-bar">
    <div class="info-item"><div class="label">Name</div><div class="val"><?= htmlspecialchars($studentInfo['name']) ?></div></div>
    <div class="info-item"><div class="label">Student ID</div><div class="val"><?= htmlspecialchars($studentInfo['student_id'] ?? '—') ?></div></div>
    <div class="info-item"><div class="label">Section</div><div class="val"><?= htmlspecialchars($studentInfo['section'] ?? '—') ?></div></div>
    <div class="info-item"><div class="label">Gender</div><div class="val"><?= ucfirst($studentInfo['gender'] ?? '—') ?></div></div>
    <div class="info-item"><div class="label">PATHFit Level</div><div class="val">PATHFit <?= $studentInfo['pathfit_level'] ?></div></div>
  </div>
  <?php endif; ?>

  <!-- Comparison Table -->
  <div class="card">
    <h3>Fitness Test Comparison</h3>
    <?php if (!empty($grouped)): ?>
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>Pre-Test Score</th>
          <th>Pre Rating</th>
          <th>Post-Test Score</th>
          <th>Post Rating</th>
          <th>Change</th>
          <th>Progress</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($testLabels as $type => $label): ?>
          <?php
            $preRecord  = latestScore($grouped[$type]['pre']  ?? []);
            $postRecord = latestScore($grouped[$type]['post'] ?? []);
          ?>
          <tr>
            <td><strong><?= $label ?></strong></td>
            <td><?= $preRecord  ? $preRecord['reps_or_cm']  : '<span class="no-data">—</span>' ?></td>
            <td>
              <?php if ($preRecord && $preRecord['rating']): ?>
                <span class="badge badge-<?= $preRecord['rating'] ?>"><?= ucwords(str_replace('_',' ',$preRecord['rating'])) ?></span>
              <?php else: ?>—<?php endif; ?>
            </td>
            <td><?= $postRecord ? $postRecord['reps_or_cm'] : '<span class="no-data">—</span>' ?></td>
            <td>
              <?php if ($postRecord && $postRecord['rating']): ?>
                <span class="badge badge-<?= $postRecord['rating'] ?>"><?= ucwords(str_replace('_',' ',$postRecord['rating'])) ?></span>
              <?php else: ?>—<?php endif; ?>
            </td>
            <td>
              <?php if ($preRecord && $postRecord):
                $diff = $postRecord['reps_or_cm'] - $preRecord['reps_or_cm'];
                $cls  = $diff > 0 ? 'up' : ($diff < 0 ? 'down' : '');
                echo '<span class="score-diff ' . $cls . '">' . ($diff > 0 ? '+' : '') . number_format($diff, 2) . '</span>';
              else: ?>—<?php endif; ?>
            </td>
            <td>
              <?php if ($preRecord && $postRecord && $preRecord['rating'] && $postRecord['rating']):
                echo improvementArrow($preRecord['rating'], $postRecord['rating']);
              else: ?>—<?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php else: ?>
      <div class="empty-state">No fitness test data available<?= $targetId ? ' for this student' : '' ?>.</div>
    <?php endif; ?>
  </div>

  <?php if (!$targetId && $isInstructor && !empty($allTests)): ?>
  <!-- Class-wide rating distribution -->
  <div class="card">
    <h3>Class-Wide Rating Distribution</h3>
    <?php
      $dist = ['excellent'=>0,'good'=>0,'fair'=>0,'needs_improvement'=>0];
      foreach ($allTests as $t) {
          if ($t['rating']) $dist[$t['rating']]++;
      }
      $total = array_sum($dist);
    ?>
    <table>
      <thead><tr><th>Rating</th><th>Count</th><th>Percentage</th></tr></thead>
      <tbody>
        <?php foreach ($dist as $r => $cnt): ?>
        <tr>
          <td><span class="badge badge-<?= $r ?>"><?= ucwords(str_replace('_',' ',$r)) ?></span></td>
          <td><?= $cnt ?></td>
          <td><?= $total > 0 ? round(($cnt/$total)*100) : 0 ?>%</td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
