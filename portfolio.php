<?php
session_start();
require_once 'config.php';
require_login();

$jwt          = $_SESSION['jwt'];
$uid          = $_SESSION['user_id'];
$isInstructor = $_SESSION['role'] === 'instructor';

// Instructor viewing a specific student
$targetId = $isInstructor
    ? (trim(filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_SPECIAL_CHARS) ?? '') ?: null)
    : $uid;

$error   = '';
$success = '';

// Handle submission (students only)
if (!$isInstructor && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $semester        = trim(filter_input(INPUT_POST, 'semester',         FILTER_SANITIZE_SPECIAL_CHARS));
    $reflection      = trim(filter_input(INPUT_POST, 'reflection_notes', FILTER_SANITIZE_SPECIAL_CHARS));

    if (!$semester || !$reflection) {
        $error = 'Please fill in all required fields.';
    } else {
        // Upsert
        $ch = curl_init(SUPABASE_URL . '/rest/v1/fitness_portfolio');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => 'POST',
            CURLOPT_POSTFIELDS     => json_encode([
                'student_id'       => $uid,
                'semester'         => $semester,
                'reflection_notes' => $reflection,
                'submitted_at'     => date('c'),
            ]),
            CURLOPT_HTTPHEADER => [
                'apikey: ' . SUPABASE_ANON_KEY,
                'Authorization: Bearer ' . $jwt,
                'Content-Type: application/json',
                'Prefer: resolution=merge-duplicates,return=representation',
            ],
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 || $code === 201) {
            $success = 'Portfolio submitted successfully!';
        } else {
            $data  = json_decode($resp, true);
            $error = 'Submission failed. ' . ($data['message'] ?? '');
        }
    }
}

// Fetch portfolios
$pfQuery = '/rest/v1/fitness_portfolio?select=*&order=submitted_at.desc';
if ($targetId) $pfQuery .= '&student_id=eq.' . urlencode($targetId);
$pfRes      = supabase_authed_request($pfQuery, 'GET', [], $jwt);
$portfolios = $pfRes['data'] ?? [];

// Fetch fitness tests for checklist
$ftQuery = '/rest/v1/fitness_tests?select=test_type,test_period';
if ($targetId) $ftQuery .= '&student_id=eq.' . urlencode($targetId);
$ftRes    = supabase_authed_request($ftQuery, 'GET', [], $jwt);
$ftData   = $ftRes['data'] ?? [];

$hasPreTests  = !empty(array_filter($ftData, fn($t) => $t['test_period'] === 'pre'));
$hasPostTests = !empty(array_filter($ftData, fn($t) => $t['test_period'] === 'post'));

// Fetch health screening
$hsRes    = supabase_authed_request('/rest/v1/health_screening?student_id=eq.' . urlencode($targetId ?? $uid) . '&select=cleared', 'GET', [], $jwt);
$cleared  = $hsRes['data'][0]['cleared'] ?? false;

// Checklist items
$checklist = [
    ['label' => 'Pre-test fitness results recorded',  'done' => $hasPreTests],
    ['label' => 'Post-test fitness results recorded', 'done' => $hasPostTests],
    ['label' => 'Health screening completed',          'done' => !empty($hsRes['data'][0])],
    ['label' => 'Health screening cleared',            'done' => $cleared],
    ['label' => 'Portfolio reflection submitted',      'done' => !empty($portfolios)],
];
$completedCount = count(array_filter($checklist, fn($c) => $c['done']));
$totalItems     = count($checklist);

// Semester options
$currentYear = date('Y');
$semesters   = [
    '1st Semester ' . $currentYear . '-' . ($currentYear+1),
    '2nd Semester ' . $currentYear . '-' . ($currentYear+1),
    'Summer ' . ($currentYear+1),
];

// Students list for instructor
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
<title>PATHFIT — Fitness Portfolio</title>
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
  .grid-2 { display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px; }
  @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 10px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); margin-bottom: 24px; }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; }
  .form-group { margin-bottom: 16px; }
  label { display: block; font-size: .85rem; font-weight: 600; color: #0a0a0a; margin-bottom: 5px; }
  select, textarea { width: 100%; padding: 10px 13px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .9rem; color: #0a0a0a; }
  textarea { min-height: 140px; resize: vertical; }
  select:focus, textarea:focus { outline: none; border-color: #185FA5; }
  .btn { width: 100%; padding: 11px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .95rem; font-weight: 700; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  .success { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  .checklist { list-style: none; }
  .checklist li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f0f4f8; font-size: .88rem; }
  .checklist li:last-child { border-bottom: none; }
  .check-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; flex-shrink: 0; }
  .check-icon.done { background: #2e7d32; color: #fff; }
  .check-icon.pending { background: #e0e8f0; color: #999; }
  .progress-bar-bg { background: #e0e8f0; border-radius: 20px; height: 12px; overflow: hidden; margin: 12px 0 6px; }
  .progress-bar-fill { height: 100%; border-radius: 20px; background: #185FA5; transition: width .4s; }
  .progress-label { font-size: .82rem; color: #555; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 9px 12px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f0f4f8; }
  tr:last-child td { border-bottom: none; }
  .empty-state { text-align: center; color: #aaa; padding: 24px 0; font-size: .88rem; }
  .back-link { display: inline-block; margin-bottom: 16px; color: #185FA5; text-decoration: none; font-size: .88rem; }
  .back-link:hover { text-decoration: underline; }
  .student-selector { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 24px; }
  .student-selector label { font-size: .85rem; font-weight: 600; color: #042C53; display: block; margin-bottom: 4px; }
  .student-selector select { padding: 9px 13px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .9rem; min-width: 260px; }
  .student-selector select:focus { outline: none; border-color: #185FA5; }
  .btn-sm { display: inline-block; padding: 9px 18px; width: auto; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Fitness Portfolio</h1>
  <nav>
    <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>">Dashboard</a>
    <a href="fitness_report.php">Reports</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>" class="back-link">← Back to Dashboard</a>
  <div class="page-title">Fitness Portfolio</div>
  <div class="page-sub">CHED-aligned semester portfolio with completion checklist and reflection submission.</div>

  <?php if ($isInstructor): ?>
  <form method="GET" action="portfolio.php">
    <div class="student-selector">
      <div>
        <label for="student_id">View Student Portfolio</label>
        <select id="student_id" name="student_id">
          <option value="">— Select Student —</option>
          <?php foreach ($studentsList as $s): ?>
            <option value="<?= htmlspecialchars($s['user_id']) ?>"
                    <?= $targetId === $s['user_id'] ? 'selected' : '' ?>>
              <?= htmlspecialchars($s['name']) ?> (<?= htmlspecialchars($s['section'] ?? '') ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <button type="submit" class="btn btn-sm">View</button>
    </div>
  </form>
  <?php endif; ?>

  <div class="grid-2">
    <!-- Submission Form (students only) -->
    <?php if (!$isInstructor): ?>
    <div class="card">
      <h3>Submit Portfolio</h3>

      <?php if ($error): ?>
        <div class="error"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <?php if ($success): ?>
        <div class="success"><?= htmlspecialchars($success) ?></div>
      <?php endif; ?>

      <form method="POST" action="portfolio.php">
        <div class="form-group">
          <label for="semester">Semester *</label>
          <select id="semester" name="semester" required>
            <option value="">— Select Semester —</option>
            <?php foreach ($semesters as $sem): ?>
              <option value="<?= htmlspecialchars($sem) ?>"
                      <?= (($_POST['semester'] ?? '') === $sem) ? 'selected' : '' ?>>
                <?= htmlspecialchars($sem) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="reflection_notes">Reflection Notes *</label>
          <textarea id="reflection_notes" name="reflection_notes"
                    placeholder="Reflect on your fitness journey this semester. What improvements did you notice? What challenges did you face? What are your goals for next semester?"
                    required><?= htmlspecialchars($_POST['reflection_notes'] ?? '') ?></textarea>
        </div>
        <button type="submit" class="btn">Submit Portfolio</button>
      </form>
    </div>
    <?php endif; ?>

    <!-- Completion Checklist -->
    <div class="card">
      <h3>CHED Completion Checklist</h3>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: <?= round(($completedCount/$totalItems)*100) ?>%"></div>
      </div>
      <div class="progress-label"><?= $completedCount ?> / <?= $totalItems ?> requirements completed</div>

      <ul class="checklist" style="margin-top:14px;">
        <?php foreach ($checklist as $item): ?>
        <li>
          <div class="check-icon <?= $item['done'] ? 'done' : 'pending' ?>">
            <?= $item['done'] ? '✓' : '○' ?>
          </div>
          <span style="<?= $item['done'] ? 'color:#2e7d32;' : 'color:#555;' ?>">
            <?= htmlspecialchars($item['label']) ?>
          </span>
        </li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>

  <!-- Submitted Portfolios -->
  <div class="card">
    <h3>Submitted Portfolios</h3>
    <?php if (!empty($portfolios)): ?>
    <table>
      <thead>
        <tr><th>Semester</th><th>Submitted</th><th>Reflection</th></tr>
      </thead>
      <tbody>
        <?php foreach ($portfolios as $pf): ?>
        <tr>
          <td><strong><?= htmlspecialchars($pf['semester']) ?></strong></td>
          <td><?= date('M j, Y g:i A', strtotime($pf['submitted_at'])) ?></td>
          <td style="max-width:400px; white-space:pre-wrap; font-size:.85rem; color:#444;">
            <?= htmlspecialchars(substr($pf['reflection_notes'] ?? '', 0, 200)) ?>
            <?= strlen($pf['reflection_notes'] ?? '') > 200 ? '...' : '' ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php else: ?>
      <div class="empty-state">No portfolio submitted yet.</div>
    <?php endif; ?>
  </div>
</div>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
