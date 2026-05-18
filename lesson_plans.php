<?php
session_start();
require_once 'config.php';
require_login();

$jwt          = $_SESSION['jwt'];
$isInstructor = $_SESSION['role'] === 'instructor';

// Determine which PATHFit level to show
$level = (int)(filter_input(INPUT_GET, 'level', FILTER_VALIDATE_INT) ?? ($_SESSION['pathfit_level'] ?? 1));
if (!in_array($level, [1,2])) $level = 1;

$error   = '';
$success = '';

// Instructor can edit lesson plans
if ($isInstructor && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $planId    = trim(filter_input(INPUT_POST, 'plan_id',    FILTER_SANITIZE_SPECIAL_CHARS));
    $topic     = trim(filter_input(INPUT_POST, 'topic',      FILTER_SANITIZE_SPECIAL_CHARS));
    $activity  = trim(filter_input(INPUT_POST, 'activity',   FILTER_SANITIZE_SPECIAL_CHARS));
    $objectives= trim(filter_input(INPUT_POST, 'objectives', FILTER_SANITIZE_SPECIAL_CHARS));

    if ($planId && $topic) {
        $res = supabase_authed_request('/rest/v1/lesson_plans?plan_id=eq.' . urlencode($planId), 'PATCH', [
            'topic'      => $topic,
            'activity'   => $activity,
            'objectives' => $objectives,
        ], $jwt);

        if ($res['status'] === 200) {
            $success = 'Lesson plan updated successfully.';
        } else {
            $error = 'Update failed. ' . ($res['data']['message'] ?? '');
        }
    }
}

// Fetch lesson plans for selected level
$lpRes = supabase_authed_request(
    '/rest/v1/lesson_plans?pathfit_level=eq.' . $level . '&select=*&order=week_number.asc',
    'GET', [], $jwt
);
$plans = $lpRes['data'] ?? [];

// Current week highlight (rough estimate)
$currentWeek = min(max(1, (int)date('W') % 16 ?: 16), 16);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Lesson Plans</title>
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
  .level-tabs { display: flex; gap: 0; margin-bottom: 24px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(4,44,83,.1); }
  .level-tab { flex: 1; text-align: center; padding: 12px; background: #fff; color: #042C53; text-decoration: none; font-weight: 600; font-size: .9rem; border: 1px solid #e0e8f0; transition: background .2s; }
  .level-tab.active { background: #185FA5; color: #fff; border-color: #185FA5; }
  .level-tab:hover:not(.active) { background: #f0f4f8; }
  .week-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .week-card { background: #fff; border-radius: 10px; padding: 18px 20px; box-shadow: 0 2px 10px rgba(4,44,83,.08); border-left: 4px solid #185FA5; transition: box-shadow .2s; }
  .week-card:hover { box-shadow: 0 4px 18px rgba(4,44,83,.14); }
  .week-card.current { border-left-color: #e65100; }
  .week-tag { font-size: .75rem; text-transform: uppercase; letter-spacing: .8px; color: #185FA5; font-weight: 700; margin-bottom: 6px; }
  .week-card.current .week-tag { color: #e65100; }
  .week-card h4 { font-size: .95rem; color: #042C53; margin-bottom: 8px; line-height: 1.3; }
  .week-card p { font-size: .82rem; color: #555; line-height: 1.5; margin-bottom: 6px; }
  .week-card .objectives { font-size: .8rem; color: #777; font-style: italic; }
  .current-badge { display: inline-block; background: #e65100; color: #fff; font-size: .7rem; padding: 2px 8px; border-radius: 20px; font-weight: 700; margin-left: 6px; vertical-align: middle; }
  .edit-btn { display: inline-block; margin-top: 10px; font-size: .78rem; color: #185FA5; cursor: pointer; text-decoration: underline; background: none; border: none; padding: 0; }
  .edit-form { display: none; margin-top: 12px; border-top: 1px solid #e8ecf0; padding-top: 12px; }
  .edit-form.open { display: block; }
  .edit-form input, .edit-form textarea {
    width: 100%; padding: 7px 10px; border: 1.5px solid #cdd5e0; border-radius: 6px;
    font-size: .82rem; color: #0a0a0a; margin-bottom: 8px;
  }
  .edit-form textarea { min-height: 60px; resize: vertical; }
  .edit-form input:focus, .edit-form textarea:focus { outline: none; border-color: #185FA5; }
  .save-btn { padding: 6px 14px; background: #185FA5; color: #fff; border: none; border-radius: 6px; font-size: .82rem; font-weight: 600; cursor: pointer; }
  .save-btn:hover { background: #042C53; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  .success { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 16px; }
  .back-link { display: inline-block; margin-bottom: 16px; color: #185FA5; text-decoration: none; font-size: .88rem; }
  .back-link:hover { text-decoration: underline; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; margin-top: 20px; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Lesson Plans</h1>
  <nav>
    <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>">Dashboard</a>
    <a href="logout.php">Logout</a>
  </nav>
</header>

<div class="container">
  <a href="<?= $isInstructor ? 'instructor_dashboard.php' : 'student_dashboard.php' ?>" class="back-link">← Back to Dashboard</a>
  <div class="page-title">16-Week Lesson Plans</div>
  <div class="page-sub">CHED-aligned PATHFit curriculum for the full semester.</div>

  <?php if ($error): ?>
    <div class="error"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="success"><?= htmlspecialchars($success) ?></div>
  <?php endif; ?>

  <!-- Level Tabs -->
  <div class="level-tabs">
    <a href="lesson_plans.php?level=1" class="level-tab <?= $level === 1 ? 'active' : '' ?>">PATHFit 1</a>
    <a href="lesson_plans.php?level=2" class="level-tab <?= $level === 2 ? 'active' : '' ?>">PATHFit 2</a>
  </div>

  <!-- Week Cards -->
  <div class="week-grid">
    <?php foreach ($plans as $plan):
      $isCurrent = $plan['week_number'] == $currentWeek;
    ?>
    <div class="week-card <?= $isCurrent ? 'current' : '' ?>">
      <div class="week-tag">
        Week <?= $plan['week_number'] ?>
        <?php if ($isCurrent): ?><span class="current-badge">Current</span><?php endif; ?>
      </div>
      <h4><?= htmlspecialchars($plan['topic']) ?></h4>
      <p>📋 <?= htmlspecialchars($plan['activity']) ?></p>
      <p class="objectives">🎯 <?= htmlspecialchars($plan['objectives']) ?></p>

      <?php if ($isInstructor): ?>
      <button class="edit-btn" onclick="toggleEdit('edit-<?= $plan['plan_id'] ?>')">✏ Edit</button>
      <div class="edit-form" id="edit-<?= $plan['plan_id'] ?>">
        <form method="POST" action="lesson_plans.php?level=<?= $level ?>">
          <input type="hidden" name="plan_id" value="<?= htmlspecialchars($plan['plan_id']) ?>">
          <label style="font-size:.78rem; font-weight:600;">Topic</label>
          <input type="text" name="topic" value="<?= htmlspecialchars($plan['topic']) ?>" required>
          <label style="font-size:.78rem; font-weight:600;">Activity</label>
          <textarea name="activity"><?= htmlspecialchars($plan['activity']) ?></textarea>
          <label style="font-size:.78rem; font-weight:600;">Objectives</label>
          <textarea name="objectives"><?= htmlspecialchars($plan['objectives']) ?></textarea>
          <button type="submit" class="save-btn">Save Changes</button>
        </form>
      </div>
      <?php endif; ?>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<script>
function toggleEdit(id) {
  var el = document.getElementById(id);
  el.classList.toggle('open');
}
</script>

<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
