<?php
session_start();
require_once 'config.php';
require_instructor();

$jwt   = $_SESSION['jwt'];
$error = '';
$success = '';

// Filters
$filterSection  = trim(filter_input(INPUT_GET, 'section',    FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
$filterStudentId= trim(filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_SPECIAL_CHARS) ?? '');

// Fetch students
$sQuery = '/rest/v1/users?role=eq.student&select=user_id,name,section,pathfit_level&order=name.asc';
if ($filterSection) $sQuery .= '&section=eq.' . urlencode($filterSection);
$studentsRes = supabase_authed_request($sQuery, 'GET', [], $jwt);
$students    = $studentsRes['data'] ?? [];

// Sections for dropdown
$allSecRes = supabase_authed_request('/rest/v1/users?role=eq.student&select=section', 'GET', [], $jwt);
$sections  = array_unique(array_column($allSecRes['data'] ?? [], 'section'));
sort($sections);

// Handle POST — mark attendance for a student
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $studentId  = trim(filter_input(INPUT_POST, 'student_id',  FILTER_SANITIZE_SPECIAL_CHARS));
    $weekNumber = (int) filter_input(INPUT_POST, 'week_number', FILTER_VALIDATE_INT);
    $date       = filter_input(INPUT_POST, 'date',       FILTER_SANITIZE_SPECIAL_CHARS);
    $status     = filter_input(INPUT_POST, 'status',     FILTER_SANITIZE_SPECIAL_CHARS);

    if (!$studentId || !$weekNumber || !$date || !in_array($status, ['present','absent','excused'])) {
        $error = 'Please fill in all fields correctly.';
    } else {
        // Upsert via POST with Prefer: resolution=merge-duplicates
        $ch = curl_init(SUPABASE_URL . '/rest/v1/attendance');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => 'POST',
            CURLOPT_POSTFIELDS     => json_encode([
                'student_id'  => $studentId,
                'week_number' => $weekNumber,
                'date'        => $date,
                'status'      => $status,
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
            $success = 'Attendance recorded successfully.';
        } else {
            $data  = json_decode($resp, true);
            $error = 'Failed to save attendance. ' . ($data['message'] ?? '');
        }
    }
}

// Fetch attendance for selected student or all
$attQuery = '/rest/v1/attendance?select=*&order=week_number.asc,date.asc';
if ($filterStudentId) $attQuery .= '&student_id=eq.' . urlencode($filterStudentId);
$attRes     = supabase_authed_request($attQuery, 'GET', [], $jwt);
$attendance = $attRes['data'] ?? [];

// Group attendance by student_id
$attByStudent = [];
foreach ($attendance as $rec) {
    $attByStudent[$rec['student_id']][] = $rec;
}

// Compute attendance % per student
function attendancePct(array $records): int {
    $total   = 16;
    $attended = count(array_filter($records, fn($r) => in_array($r['status'], ['present','excused'])));
    return (int) round(($attended / $total) * 100);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Attendance Tracker</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #0a0a0a; }
  header { background: #042C53; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  header h1 { font-size: 1.2rem; }
  header nav a { color: #fff; text-decoration: none; margin-left: 18px; font-size: .88rem; opacity: .85; }
  header nav a:hover { opacity: 1; text-decoration: underline; }
  .container { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
  .page-title { font-size: 1.4rem; color: #042C53; margin-bottom: 4px; }
  .page-sub { color: #555; font-size: .9rem; margin-bottom: 24px; }
  .grid-2 { display: grid; grid-template-columns: 340px 1fr; gap: 24px; }
  @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 10px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: .85rem; font-weight: 600; color: #0a0a0a; margin-bottom: 4px; }
  select, input[type=date], input[type=number] {
    width: 100%; padding: 9px 12px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .9rem; color: #0a0a0a;
  }
  select:focus, input:focus { outline: none; border-color: #185FA5; }
  .btn { width: 100%; padding: 11px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .95rem; font-weight: 700; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .btn-sm { display: inline-block; padding: 5px 12px; font-size: .8rem; width: auto; text-decoration: none; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 14px; }
  .success { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 14px; }
  .filter-bar { background: #fff; border-radius: 10px; padding: 14px 20px; box-shadow: 0 2px 12px rgba(4,44,83,.08); margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .filter-bar label { font-size: .82rem; font-weight: 600; color: #042C53; display: block; margin-bottom: 4px; }
  .filter-bar select { padding: 8px 12px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .88rem; }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 9px 10px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 9px 10px; border-bottom: 1px solid #f0f4f8; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: .75rem; font-weight: 600; color: #fff; }
  .badge-present { background: #2e7d32; }
  .badge-absent  { background: #c62828; }
  .badge-excused { background: #e65100; }
  .pct-bar-bg { background: #e0e8f0; border-radius: 20px; height: 10px; overflow: hidden; min-width: 80px; }
  .pct-bar-fill { height: 100%; border-radius: 20px; background: #185FA5; }
  .pct-bar-fill.danger { background: #e53935; }
  .flag { color: #e53935; font-size: .78rem; font-weight: 700; }
  .empty-state { text-align: center; color: #aaa; padding: 24px 0; font-size: .88rem; }
  .back-link { display: inline-block; margin-bottom: 16px; color: #185FA5; text-decoration: none; font-size: .88rem; }
  .back-link:hover { text-decoration: underline; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Attendance Tracker</h1>
  <nav>
    <a href="instructor_dashboard.php">Dashboard</a>
    <a href="fitness_test_entry.php">Fitness Tests</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <a href="instructor_dashboard.php" class="back-link">← Back to Dashboard</a>
  <div class="page-title">Attendance Tracker</div>
  <div class="page-sub">Record weekly attendance and monitor students below the 75% threshold.</div>

  <!-- Filter -->
  <form method="GET" action="attendance_tracker.php">
    <div class="filter-bar">
      <div>
        <label>Filter by Section</label>
        <select name="section">
          <option value="">All Sections</option>
          <?php foreach ($sections as $sec): ?>
            <option value="<?= htmlspecialchars($sec) ?>" <?= $filterSection === $sec ? 'selected' : '' ?>>
              <?= htmlspecialchars($sec) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label>Filter by Student</label>
        <select name="student_id">
          <option value="">All Students</option>
          <?php foreach ($students as $s): ?>
            <option value="<?= htmlspecialchars($s['user_id']) ?>" <?= $filterStudentId === $s['user_id'] ? 'selected' : '' ?>>
              <?= htmlspecialchars($s['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <button type="submit" class="btn btn-sm" style="padding:9px 18px;">Filter</button>
        <a href="attendance_tracker.php" class="btn btn-sm" style="background:#6c757d; margin-left:8px;">Reset</a>
      </div>
    </div>
  </form>

  <div class="grid-2">
    <!-- Mark Attendance Form -->
    <div class="card">
      <h3>Mark Attendance</h3>

      <?php if ($error): ?>
        <div class="error"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>
      <?php if ($success): ?>
        <div class="success"><?= htmlspecialchars($success) ?></div>
      <?php endif; ?>

      <form method="POST" action="attendance_tracker.php<?= $filterSection ? '?section='.urlencode($filterSection) : '' ?>">
        <div class="form-group">
          <label for="student_id_form">Student *</label>
          <select id="student_id_form" name="student_id" required>
            <option value="">— Select Student —</option>
            <?php foreach ($students as $s): ?>
              <option value="<?= htmlspecialchars($s['user_id']) ?>"
                      <?= (($_POST['student_id'] ?? '') === $s['user_id']) ? 'selected' : '' ?>>
                <?= htmlspecialchars($s['name']) ?> (<?= htmlspecialchars($s['section'] ?? '') ?>)
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="week_number">Week Number *</label>
          <select id="week_number" name="week_number" required>
            <option value="">— Select Week —</option>
            <?php for ($w = 1; $w <= 16; $w++): ?>
              <option value="<?= $w ?>" <?= (($_POST['week_number'] ?? '') == $w) ? 'selected' : '' ?>>Week <?= $w ?></option>
            <?php endfor; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="date">Date *</label>
          <input type="date" id="date" name="date" value="<?= htmlspecialchars($_POST['date'] ?? date('Y-m-d')) ?>" required>
        </div>
        <div class="form-group">
          <label for="status">Status *</label>
          <select id="status" name="status" required>
            <option value="">— Select Status —</option>
            <option value="present" <?= (($_POST['status'] ?? '') === 'present') ? 'selected' : '' ?>>Present</option>
            <option value="absent"  <?= (($_POST['status'] ?? '') === 'absent')  ? 'selected' : '' ?>>Absent</option>
            <option value="excused" <?= (($_POST['status'] ?? '') === 'excused') ? 'selected' : '' ?>>Excused</option>
          </select>
        </div>
        <button type="submit" class="btn">Save Attendance</button>
      </form>
    </div>

    <!-- Attendance Summary Table -->
    <div class="card">
      <h3>Attendance Summary</h3>
      <?php if (!empty($students)): ?>
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Section</th>
            <th>Attended</th>
            <th>Rate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($students as $s):
            $recs     = $attByStudent[$s['user_id']] ?? [];
            $attended = count(array_filter($recs, fn($r) => in_array($r['status'],['present','excused'])));
            $pct      = (int) round(($attended / 16) * 100);
            $flag     = $pct < 75;
          ?>
          <tr>
            <td><strong><?= htmlspecialchars($s['name']) ?></strong></td>
            <td><?= htmlspecialchars($s['section'] ?? '—') ?></td>
            <td><?= $attended ?>/16</td>
            <td>
              <div class="pct-bar-bg">
                <div class="pct-bar-fill <?= $flag ? 'danger' : '' ?>" style="width:<?= $pct ?>%"></div>
              </div>
              <small><?= $pct ?>%</small>
            </td>
            <td>
              <?php if ($flag): ?>
                <span class="flag">⚠ Below 75%</span>
              <?php else: ?>
                <span style="color:#2e7d32; font-size:.78rem; font-weight:600;">✔ OK</span>
              <?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <?php else: ?>
        <div class="empty-state">No students found.</div>
      <?php endif; ?>
    </div>
  </div>

  <!-- Detailed Records -->
  <?php if ($filterStudentId && !empty($attendance)): ?>
  <div class="card" style="margin-top:0;">
    <h3>Detailed Records</h3>
    <table>
      <thead><tr><th>Week</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>
        <?php foreach ($attendance as $rec): ?>
        <tr>
          <td>Week <?= $rec['week_number'] ?></td>
          <td><?= date('M j, Y', strtotime($rec['date'])) ?></td>
          <td><span class="badge badge-<?= $rec['status'] ?>"><?= ucfirst($rec['status']) ?></span></td>
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
