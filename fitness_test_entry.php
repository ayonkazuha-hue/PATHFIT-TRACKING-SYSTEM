<?php
session_start();
require_once 'config.php';
require_login();

$jwt        = $_SESSION['jwt'];
$isInstructor = $_SESSION['role'] === 'instructor';

// Rubric tables (gender-specific)
// Returns rating string based on test type, gender, value
function getRating(string $testType, string $gender, float $value): string
{
    $rubrics = [
        'push_ups' => [
            'male'   => [['excellent',36],['good',29],['fair',22],['needs_improvement',0]],
            'female' => [['excellent',20],['good',15],['fair',10],['needs_improvement',0]],
        ],
        'sit_ups' => [
            'male'   => [['excellent',38],['good',31],['fair',24],['needs_improvement',0]],
            'female' => [['excellent',32],['good',25],['fair',18],['needs_improvement',0]],
        ],
        'sit_reach' => [
            'male'   => [['excellent',27],['good',17],['fair',6],['needs_improvement',0]],
            'female' => [['excellent',30],['good',21],['fair',11],['needs_improvement',0]],
        ],
        'step_test' => [
            // Lower heart rate = better; thresholds reversed
            'male'   => [['needs_improvement',100],['fair',90],['good',80],['excellent',0]],
            'female' => [['needs_improvement',105],['fair',95],['good',85],['excellent',0]],
        ],
        'shuttle_run' => [
            // Lower time = better; thresholds reversed
            'male'   => [['needs_improvement',12.0],['fair',11.0],['good',10.0],['excellent',0]],
            'female' => [['needs_improvement',13.5],['fair',12.5],['good',11.5],['excellent',0]],
        ],
    ];

    if (!isset($rubrics[$testType][$gender])) return 'fair';

    $table = $rubrics[$testType][$gender];

    // step_test and shuttle_run: lower is better
    if (in_array($testType, ['step_test','shuttle_run'])) {
        foreach ($table as [$rating, $threshold]) {
            if ($value >= $threshold) return $rating;
        }
        return 'excellent';
    }

    // Others: higher is better
    foreach ($table as [$rating, $threshold]) {
        if ($value >= $threshold) return $rating;
    }
    return 'needs_improvement';
}

$error   = '';
$success = '';

// Fetch students list (instructor sees all; student sees only self)
if ($isInstructor) {
    $studentsRes = supabase_authed_request('/rest/v1/users?role=eq.student&select=user_id,name,gender,section&order=name.asc', 'GET', [], $jwt);
    $students    = $studentsRes['data'] ?? [];
} else {
    $students = [[
        'user_id' => $_SESSION['user_id'],
        'name'    => $_SESSION['name'],
        'gender'  => '', // will be fetched below
    ]];
}

// Pre-select student from GET param
$selectedStudentId = filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_SPECIAL_CHARS) ?? '';

// Fetch selected student's gender for auto-rating
$selectedGender = '';
if ($selectedStudentId) {
    $sgRes = supabase_authed_request('/rest/v1/users?user_id=eq.' . urlencode($selectedStudentId) . '&select=gender', 'GET', [], $jwt);
    $selectedGender = $sgRes['data'][0]['gender'] ?? '';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $targetStudentId = trim(filter_input(INPUT_POST, 'target_student_id', FILTER_SANITIZE_SPECIAL_CHARS));
    $testType        = filter_input(INPUT_POST, 'test_type',   FILTER_SANITIZE_SPECIAL_CHARS);
    $testPeriod      = filter_input(INPUT_POST, 'test_period', FILTER_SANITIZE_SPECIAL_CHARS);
    $repsOrCm        = (float) filter_input(INPUT_POST, 'reps_or_cm', FILTER_VALIDATE_FLOAT);
    $gender          = filter_input(INPUT_POST, 'student_gender', FILTER_SANITIZE_SPECIAL_CHARS);

    if (!$targetStudentId || !$testType || !$testPeriod || $repsOrCm === false) {
        $error = 'Please fill in all required fields.';
    } else {
        $rating = getRating($testType, $gender, $repsOrCm);

        $res = supabase_authed_request('/rest/v1/fitness_tests', 'POST', [
            'student_id'  => $targetStudentId,
            'test_type'   => $testType,
            'test_period' => $testPeriod,
            'reps_or_cm'  => $repsOrCm,
            'rating'      => $rating,
            'recorded_by' => $_SESSION['user_id'],
        ], $jwt);

        if ($res['status'] === 201) {
            $success = 'Fitness test recorded successfully! Rating: <strong>' . ucwords(str_replace('_',' ',$rating)) . '</strong>';
        } else {
            $error = 'Failed to save test. ' . ($res['data']['message'] ?? '');
        }
    }
}

// Fetch existing tests for selected student
$existingTests = [];
if ($selectedStudentId) {
    $etRes = supabase_authed_request(
        '/rest/v1/fitness_tests?student_id=eq.' . urlencode($selectedStudentId) . '&select=*&order=created_at.desc',
        'GET', [], $jwt
    );
    $existingTests = $etRes['data'] ?? [];
}

$testLabels = [
    'push_ups'    => 'Push-Ups (reps)',
    'sit_ups'     => 'Sit-Ups (reps)',
    'sit_reach'   => 'Sit & Reach (cm)',
    'step_test'   => 'Step Test (heart rate bpm)',
    'shuttle_run' => 'Shuttle Run (seconds)',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Fitness Test Entry</title>
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
  .grid-2 { display: grid; grid-template-columns: 1fr 1.4fr; gap: 24px; }
  @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; }
  .form-group { margin-bottom: 16px; }
  label { display: block; font-size: .85rem; font-weight: 600; color: #0a0a0a; margin-bottom: 5px; }
  select, input[type=number], input[type=text] {
    width: 100%; padding: 10px 13px; border: 1.5px solid #cdd5e0; border-radius: 7px;
    font-size: .92rem; color: #0a0a0a;
  }
  select:focus, input:focus { outline: none; border-color: #185FA5; }
  .btn { width: 100%; padding: 11px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .95rem; font-weight: 700; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  .success { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 9px 10px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 9px 10px; border-bottom: 1px solid #f0f4f8; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: .75rem; font-weight: 600; color: #fff; }
  .badge-excellent { background: #2e7d32; }
  .badge-good { background: #1565c0; }
  .badge-fair { background: #e65100; }
  .badge-needs_improvement { background: #c62828; }
  .badge-pre { background: #6a1b9a; }
  .badge-post { background: #00695c; }
  .rubric-box { background: #f5f8fc; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: .82rem; }
  .rubric-box h4 { color: #042C53; margin-bottom: 8px; font-size: .85rem; }
  .rubric-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e8ecf0; }
  .rubric-row:last-child { border-bottom: none; }
  .empty-state { text-align: center; color: #aaa; padding: 24px 0; font-size: .88rem; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
  .back-link { display: inline-block; margin-bottom: 16px; color: #185FA5; text-decoration: none; font-size: .88rem; }
  .back-link:hover { text-decoration: underline; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Fitness Test Entry</h1>
  <nav>
    <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>">Dashboard</a>
    <a href="fitness_report.php">Pre/Post Report</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>" class="back-link">← Back to Dashboard</a>
  <div class="page-title">Fitness Test Entry</div>
  <div class="page-sub">Record pre-test and post-test results. Ratings are auto-calculated based on gender-specific rubrics.</div>

  <div class="grid-2">
    <!-- Entry Form -->
    <div class="card">
      <h3>Record New Test</h3>

      <?php if ($error): ?>
        <div class="error"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <?php if ($success): ?>
        <div class="success"><?= $success ?></div>
      <?php endif; ?>

      <form method="POST" action="fitness_test_entry.php<?= $selectedStudentId ? '?student_id='.urlencode($selectedStudentId) : '' ?>">
        <?php if ($isInstructor): ?>
        <div class="form-group">
          <label for="target_student_id">Student *</label>
          <select id="target_student_id" name="target_student_id" required
                  onchange="this.form.submit()">
            <option value="">— Select Student —</option>
            <?php foreach ($students as $s): ?>
              <option value="<?= htmlspecialchars($s['user_id']) ?>"
                      data-gender="<?= htmlspecialchars($s['gender']) ?>"
                      <?= $selectedStudentId === $s['user_id'] ? 'selected' : '' ?>>
                <?= htmlspecialchars($s['name']) ?> (<?= htmlspecialchars($s['section'] ?? '') ?>)
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <?php else: ?>
          <input type="hidden" name="target_student_id" value="<?= htmlspecialchars($_SESSION['user_id']) ?>">
        <?php endif; ?>

        <input type="hidden" name="student_gender" value="<?= htmlspecialchars($selectedGender) ?>">

        <div class="form-group">
          <label for="test_type">Test Type *</label>
          <select id="test_type" name="test_type" required>
            <option value="">— Select Test —</option>
            <?php foreach ($testLabels as $val => $lbl): ?>
              <option value="<?= $val ?>" <?= (($_POST['test_type'] ?? '') === $val) ? 'selected' : '' ?>>
                <?= $lbl ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="form-group">
          <label for="test_period">Test Period *</label>
          <select id="test_period" name="test_period" required>
            <option value="">— Select Period —</option>
            <option value="pre"  <?= (($_POST['test_period'] ?? '') === 'pre')  ? 'selected' : '' ?>>Pre-Test</option>
            <option value="post" <?= (($_POST['test_period'] ?? '') === 'post') ? 'selected' : '' ?>>Post-Test</option>
          </select>
        </div>

        <div class="form-group">
          <label for="reps_or_cm">Score (reps / cm / bpm / seconds) *</label>
          <input type="number" id="reps_or_cm" name="reps_or_cm" step="0.01" min="0"
                 placeholder="e.g. 25" value="<?= htmlspecialchars($_POST['reps_or_cm'] ?? '') ?>" required>
        </div>

        <button type="submit" class="btn">Save Test Result</button>
      </form>

      <!-- Rubric Reference -->
      <div class="rubric-box">
        <h4>Push-Up Rubric Reference</h4>
        <div class="rubric-row"><span>Male — Excellent</span><span>≥ 36 reps</span></div>
        <div class="rubric-row"><span>Male — Good</span><span>29–35 reps</span></div>
        <div class="rubric-row"><span>Male — Fair</span><span>22–28 reps</span></div>
        <div class="rubric-row"><span>Male — Needs Improvement</span><span>&lt; 22 reps</span></div>
        <div class="rubric-row" style="margin-top:6px;"><span>Female — Excellent</span><span>≥ 20 reps</span></div>
        <div class="rubric-row"><span>Female — Good</span><span>15–19 reps</span></div>
        <div class="rubric-row"><span>Female — Fair</span><span>10–14 reps</span></div>
        <div class="rubric-row"><span>Female — Needs Improvement</span><span>&lt; 10 reps</span></div>
      </div>
    </div>

    <!-- Existing Tests -->
    <div class="card">
      <h3>Recorded Tests <?= $selectedStudentId ? '— ' . htmlspecialchars($students[array_search($selectedStudentId, array_column($students,'user_id'))]['name'] ?? '') : '' ?></h3>
      <?php if (!empty($existingTests)): ?>
      <table>
        <thead>
          <tr><th>Test</th><th>Period</th><th>Score</th><th>Rating</th><th>Date</th></tr>
        </thead>
        <tbody>
          <?php foreach ($existingTests as $t): ?>
          <tr>
            <td><?= $testLabels[$t['test_type']] ?? $t['test_type'] ?></td>
            <td><span class="badge badge-<?= $t['test_period'] ?>"><?= ucfirst($t['test_period']) ?></span></td>
            <td><?= $t['reps_or_cm'] ?></td>
            <td>
              <?php if ($t['rating']): ?>
                <span class="badge badge-<?= $t['rating'] ?>"><?= ucwords(str_replace('_',' ',$t['rating'])) ?></span>
              <?php else: ?>—<?php endif; ?>
            </td>
            <td><?= date('M j, Y', strtotime($t['created_at'])) ?></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <?php elseif ($selectedStudentId): ?>
        <div class="empty-state">No tests recorded for this student yet.</div>
      <?php else: ?>
        <div class="empty-state">Select a student to view their test history.</div>
      <?php endif; ?>
    </div>
  </div>
</div>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
