<?php
session_start();
require_once 'config.php';
require_instructor();

$jwt = $_SESSION['jwt'];

// Filters
$filterSection = trim(filter_input(INPUT_GET, 'section',       FILTER_SANITIZE_SPECIAL_CHARS) ?? '');
$filterLevel   = (int)(filter_input(INPUT_GET, 'pathfit_level', FILTER_VALIDATE_INT) ?? 0);
$filterGender  = trim(filter_input(INPUT_GET, 'gender',        FILTER_SANITIZE_SPECIAL_CHARS) ?? '');

// Build query
$query = '/rest/v1/users?role=eq.student&select=*&order=name.asc';
if ($filterSection) $query .= '&section=eq.' . urlencode($filterSection);
if ($filterLevel)   $query .= '&pathfit_level=eq.' . $filterLevel;
if ($filterGender)  $query .= '&gender=eq.' . urlencode($filterGender);

$studentsRes = supabase_authed_request($query, 'GET', [], $jwt);
$students    = $studentsRes['data'] ?? [];

// Stats
$totalStudents = count($students);
$maleCount     = count(array_filter($students, fn($s) => $s['gender'] === 'male'));
$femaleCount   = count(array_filter($students, fn($s) => $s['gender'] === 'female'));
$pf1Count      = count(array_filter($students, fn($s) => $s['pathfit_level'] == 1));
$pf2Count      = count(array_filter($students, fn($s) => $s['pathfit_level'] == 2));

// Distinct sections for filter dropdown
$allSectionsRes = supabase_authed_request('/rest/v1/users?role=eq.student&select=section', 'GET', [], $jwt);
$sections = array_unique(array_column($allSectionsRes['data'] ?? [], 'section'));
sort($sections);

// Pending health screenings
$pendingHsRes = supabase_authed_request(
    '/rest/v1/health_screening?cleared=eq.false&select=student_id',
    'GET', [], $jwt
);
$pendingScreenings = count($pendingHsRes['data'] ?? []);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Instructor Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #0a0a0a; }
  header { background: #042C53; color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
  header .brand h1 { font-size: 1.2rem; }
  header .brand span { font-size: .8rem; opacity: .7; }
  header nav a { color: #fff; text-decoration: none; margin-left: 18px; font-size: .88rem; opacity: .85; }
  header nav a:hover { opacity: 1; text-decoration: underline; }
  .container { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
  .page-title { font-size: 1.5rem; color: #042C53; margin-bottom: 4px; }
  .page-sub { color: #555; font-size: .9rem; margin-bottom: 24px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: #fff; border-radius: 10px; padding: 18px 20px; box-shadow: 0 2px 12px rgba(4,44,83,.08); border-left: 4px solid #185FA5; }
  .stat-card.warn { border-left-color: #e53935; }
  .stat-card .label { font-size: .75rem; text-transform: uppercase; letter-spacing: .8px; color: #666; margin-bottom: 5px; }
  .stat-card .value { font-size: 1.9rem; font-weight: 700; color: #042C53; }
  .stat-card.warn .value { color: #e53935; }
  .stat-card .sub { font-size: .78rem; color: #888; margin-top: 3px; }
  .filter-bar { background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 2px 12px rgba(4,44,83,.08); margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .filter-bar label { font-size: .82rem; font-weight: 600; color: #042C53; display: block; margin-bottom: 4px; }
  .filter-bar select, .filter-bar input { padding: 8px 12px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .88rem; color: #0a0a0a; }
  .filter-bar select:focus, .filter-bar input:focus { outline: none; border-color: #185FA5; }
  .btn { display: inline-block; padding: 9px 18px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: .88rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .btn-outline { background: transparent; border: 2px solid #185FA5; color: #185FA5; }
  .btn-outline:hover { background: #185FA5; color: #fff; }
  .btn-sm { padding: 5px 12px; font-size: .8rem; }
  .card { background: #fff; border-radius: 10px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(4,44,83,.08); margin-bottom: 24px; }
  .card h3 { font-size: 1rem; color: #042C53; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8ecf0; display: flex; justify-content: space-between; align-items: center; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { background: #f5f8fc; color: #042C53; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e0e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; vertical-align: middle; }
  tr:hover td { background: #f8fafc; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: .75rem; font-weight: 600; color: #fff; }
  .badge-male { background: #1565c0; }
  .badge-female { background: #ad1457; }
  .badge-1 { background: #2e7d32; }
  .badge-2 { background: #6a1b9a; }
  .empty-state { text-align: center; color: #aaa; padding: 32px 0; font-size: .9rem; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
  .action-links a { color: #185FA5; text-decoration: none; font-size: .82rem; margin-right: 10px; }
  .action-links a:hover { text-decoration: underline; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>PATHFIT Tracking System</h1>
    <span>Instructor Portal — <?= htmlspecialchars($_SESSION['name']) ?></span>
  </div>
  <nav>
    <a href="fitness_test_entry.php">Record Tests</a>
    <a href="lesson_plans.php">Lesson Plans</a>
    <a href="fitness_report.php">Reports</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <div class="page-title">Instructor Dashboard</div>
  <div class="page-sub">Manage students and track fitness progress.</div>

  <!-- Stat Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">Total Students</div>
      <div class="value"><?= $totalStudents ?></div>
      <div class="sub"><?= $maleCount ?> male · <?= $femaleCount ?> female</div>
    </div>
    <div class="stat-card">
      <div class="label">PATHFit 1</div>
      <div class="value"><?= $pf1Count ?></div>
      <div class="sub">enrolled students</div>
    </div>
    <div class="stat-card">
      <div class="label">PATHFit 2</div>
      <div class="value"><?= $pf2Count ?></div>
      <div class="sub">enrolled students</div>
    </div>
    <div class="stat-card <?= $pendingScreenings > 0 ? 'warn' : '' ?>">
      <div class="label">Pending Screenings</div>
      <div class="value"><?= $pendingScreenings ?></div>
      <div class="sub">awaiting clearance</div>
    </div>
  </div>

  <!-- Filter Bar -->
  <form method="GET" action="instructor_dashboard.php">
    <div class="filter-bar">
      <div>
        <label>Section Code</label>
        <select name="section">
          <option value="">All Section Codes</option>
          <?php foreach ($sections as $sec): ?>
            <option value="<?= htmlspecialchars($sec) ?>" <?= $filterSection === $sec ? 'selected' : '' ?>>
              <?= htmlspecialchars($sec) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label>PATHFit Level</label>
        <select name="pathfit_level">
          <option value="">All Levels</option>
          <option value="1" <?= $filterLevel === 1 ? 'selected' : '' ?>>PATHFit 1</option>
          <option value="2" <?= $filterLevel === 2 ? 'selected' : '' ?>>PATHFit 2</option>
        </select>
      </div>
      <div>
        <label>Gender</label>
        <select name="gender">
          <option value="">All Genders</option>
          <option value="male"   <?= $filterGender === 'male'   ? 'selected' : '' ?>>Male</option>
          <option value="female" <?= $filterGender === 'female' ? 'selected' : '' ?>>Female</option>
        </select>
      </div>
      <div>
        <button type="submit" class="btn">Filter</button>
        <a href="instructor_dashboard.php" class="btn btn-outline" style="margin-left:8px;">Reset</a>
      </div>
    </div>
  </form>

  <!-- Students Table -->
  <div class="card">
    <h3>
      Student List
      <span style="font-size:.82rem; font-weight:400; color:#555;"><?= $totalStudents ?> student(s) found</span>
    </h3>
    <?php if (!empty($students)): ?>
    <table>
      <thead>
        <tr>
          <th>Student ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Section Code</th>
          <th>Course</th>
          <th>Year</th>
          <th>Gender</th>
          <th>PATHFit</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($students as $s): ?>
        <tr>
          <td><?= htmlspecialchars($s['student_id'] ?? '—') ?></td>
          <td><strong><?= htmlspecialchars($s['name']) ?></strong></td>
          <td><?= htmlspecialchars($s['email']) ?></td>
          <td><?= htmlspecialchars($s['section'] ?? '—') ?></td>
          <td><?= htmlspecialchars($s['course'] ?? '—') ?></td>
          <td><?= $s['year_level'] ?? '—' ?></td>
          <td><span class="badge badge-<?= $s['gender'] ?>"><?= ucfirst($s['gender'] ?? '—') ?></span></td>
          <td><span class="badge badge-<?= $s['pathfit_level'] ?>">PF<?= $s['pathfit_level'] ?></span></td>
          <td class="action-links">
            <a href="fitness_test_entry.php?student_id=<?= urlencode($s['user_id']) ?>">Tests</a>
            <a href="fitness_report.php?student_id=<?= urlencode($s['user_id']) ?>">Report</a>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php else: ?>
      <div class="empty-state">No students found matching the selected filters.</div>
    <?php endif; ?>
  </div>

  <!-- Quick Links -->
  <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px;">
    <a href="fitness_test_entry.php" class="btn">+ Record Fitness Test</a>
    <a href="lesson_plans.php" class="btn">View Lesson Plans</a>
    <a href="fitness_report.php" class="btn">Pre/Post Report</a>
  </div>
</div>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
