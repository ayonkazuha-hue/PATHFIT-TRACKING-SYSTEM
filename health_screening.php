<?php
session_start();
require_once 'config.php';
require_login();

// Only students need screening; instructors skip
if ($_SESSION['role'] === 'instructor') {
    header('Location: instructor_dashboard.php');
    exit;
}

$error   = '';
$success = '';

$conditions = [
    'Asthma or respiratory condition',
    'Heart disease or hypertension',
    'Diabetes',
    'Epilepsy or seizure disorder',
    'Musculoskeletal disorder',
    'Recent surgery (within 6 months)',
    'Pregnancy',
    'Severe allergies',
    'Visual or hearing impairment',
    'None of the above',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $injury_history    = trim(filter_input(INPUT_POST, 'injury_history', FILTER_SANITIZE_SPECIAL_CHARS));
    $selected          = $_POST['health_conditions'] ?? [];
    $health_conditions = implode(', ', array_map('htmlspecialchars', $selected));

    $res = supabase_authed_request('/rest/v1/health_screening', 'POST', [
        'student_id'        => $_SESSION['user_id'],
        'injury_history'    => $injury_history,
        'health_conditions' => $health_conditions,
        'cleared'           => false,
    ], $_SESSION['jwt']);

    if ($res['status'] === 201) {
        header('Location: student_dashboard.php');
        exit;
    } else {
        $error = 'Could not save screening. Please try again.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT — Health Screening</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; flex-direction: column; }
  header { background: #042C53; color: #fff; padding: 18px 32px; display: flex; justify-content: space-between; align-items: center; }
  header h1 { font-size: 1.3rem; }
  header a { color: #fff; font-size: .85rem; text-decoration: none; opacity: .8; }
  header a:hover { opacity: 1; }
  main { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(4,44,83,.12); padding: 40px 36px; width: 100%; max-width: 580px; }
  .card h2 { color: #042C53; font-size: 1.4rem; margin-bottom: 6px; }
  .card p.sub { color: #555; font-size: .9rem; margin-bottom: 28px; line-height: 1.5; }
  .notice { background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 16px; border-radius: 6px; font-size: .88rem; color: #5d4037; margin-bottom: 24px; }
  label.field-label { display: block; font-size: .88rem; color: #0a0a0a; margin-bottom: 5px; font-weight: 600; }
  textarea { width: 100%; padding: 11px 14px; border: 1.5px solid #cdd5e0; border-radius: 7px; font-size: .9rem; color: #0a0a0a; resize: vertical; min-height: 90px; margin-bottom: 20px; }
  textarea:focus { outline: none; border-color: #185FA5; }
  .checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
  .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: .88rem; color: #0a0a0a; }
  .checkbox-item input[type=checkbox] { width: 16px; height: 16px; accent-color: #185FA5; cursor: pointer; }
  .btn { width: 100%; padding: 12px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #042C53; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 18px; }
  .section-title { font-size: .8rem; text-transform: uppercase; letter-spacing: 1px; color: #185FA5; font-weight: 700; margin: 0 0 12px; border-bottom: 1px solid #e0e8f0; padding-bottom: 6px; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT — Health Screening</h1>
  <a href="logout.php">Logout</a>
</header>
<main>
  <div class="card">
    <h2>Pre-Participation Health Screening</h2>
    <p class="sub">Welcome, <strong><?= htmlspecialchars($_SESSION['name']) ?></strong>! Before you begin your PATHFit activities, please complete this one-time health screening form. Your information is confidential and will only be reviewed by your instructor.</p>

    <div class="notice">
      ⚠️ This form must be completed honestly. Providing false information may put your health at risk during physical activities.
    </div>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form method="POST" action="health_screening.php">
      <div class="section-title">Injury History</div>
      <label class="field-label" for="injury_history">
        Describe any past injuries, surgeries, or physical limitations (write "None" if not applicable):
      </label>
      <textarea id="injury_history" name="injury_history" placeholder="e.g., Sprained left ankle in 2023, fully recovered..."><?= htmlspecialchars($_POST['injury_history'] ?? '') ?></textarea>

      <div class="section-title">Current Health Conditions</div>
      <label class="field-label">Select all conditions that apply to you:</label>
      <div class="checkbox-grid">
        <?php foreach ($conditions as $cond): ?>
          <label class="checkbox-item">
            <input type="checkbox" name="health_conditions[]" value="<?= htmlspecialchars($cond) ?>"
              <?= in_array($cond, $_POST['health_conditions'] ?? []) ? 'checked' : '' ?>>
            <?= htmlspecialchars($cond) ?>
          </label>
        <?php endforeach; ?>
      </div>

      <button type="submit" class="btn">Submit Health Screening</button>
    </form>
  </div>
</main>
<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
