<?php
session_start();
require_once 'config.php';

if (!empty($_SESSION['user_id'])) {
    header('Location: ' . ($_SESSION['role'] === 'instructor' ? 'instructor_dashboard.php' : 'student_dashboard.php'));
    exit;
}

$error   = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name          = trim(filter_input(INPUT_POST, 'name',          FILTER_SANITIZE_SPECIAL_CHARS));
    $student_id    = trim(filter_input(INPUT_POST, 'student_id',    FILTER_SANITIZE_SPECIAL_CHARS));
    $email         = trim(filter_input(INPUT_POST, 'email',         FILTER_SANITIZE_EMAIL));
    $password      = trim(filter_input(INPUT_POST, 'password',      FILTER_DEFAULT));
    $confirm_pass  = trim(filter_input(INPUT_POST, 'confirm_pass',  FILTER_DEFAULT));
    $section       = trim(filter_input(INPUT_POST, 'section',       FILTER_SANITIZE_SPECIAL_CHARS));
    $course        = trim(filter_input(INPUT_POST, 'course',        FILTER_SANITIZE_SPECIAL_CHARS));
    $gender        = filter_input(INPUT_POST, 'gender',       FILTER_SANITIZE_SPECIAL_CHARS);
    $year_level    = (int) filter_input(INPUT_POST, 'year_level',   FILTER_VALIDATE_INT);
    $pathfit_level = (int) filter_input(INPUT_POST, 'pathfit_level',FILTER_VALIDATE_INT);

    // Validation
    if (!$name || !$email || !$password || !$student_id) {
        $error = 'Please fill in all required fields.';
    } elseif ($password !== $confirm_pass) {
        $error = 'Passwords do not match.';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } elseif (!in_array($gender, ['male','female'])) {
        $error = 'Please select a valid gender.';
    } elseif (!in_array($year_level, [1,2,3,4,5])) {
        $error = 'Please select a valid year level.';
    } elseif (!in_array($pathfit_level, [1,2])) {
        $error = 'Please select PATHFit level 1 or 2.';
    } else {
        // 1. Create Supabase Auth user
        $authRes = supabase_auth('/signup', [
            'email'    => $email,
            'password' => $password,
        ]);

        if ($authRes['status'] === 200 && !empty($authRes['data']['user']['id'])) {
            $uid = $authRes['data']['user']['id'];

            // 2. Insert profile into users table (service key bypasses RLS for insert)
            $profileRes = supabase_request('/rest/v1/users', 'POST', [
                'user_id'       => $uid,
                'student_id'    => $student_id,
                'name'          => $name,
                'email'         => $email,
                'section'       => $section,
                'course'        => $course,
                'gender'        => $gender,
                'year_level'    => $year_level,
                'pathfit_level' => $pathfit_level,
                'role'          => 'student',
            ], true);

            if ($profileRes['status'] === 201) {
                $success = 'Registration successful! You can now <a href="login.php">log in</a>.';
            } else {
                $error = 'Profile creation failed. ' . ($profileRes['data']['message'] ?? 'Please try again.');
            }
        } else {
            $error = $authRes['data']['msg'] ?? ($authRes['data']['error_description'] ?? 'Registration failed. Email may already be in use.');
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PATHFIT Tracking — Register</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; flex-direction: column; }
  header { background: #042C53; color: #fff; padding: 18px 32px; }
  header h1 { font-size: 1.4rem; }
  header span { font-size: .85rem; opacity: .75; }
  main { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(4,44,83,.12); padding: 40px 36px; width: 100%; max-width: 560px; }
  .card h2 { color: #042C53; font-size: 1.5rem; margin-bottom: 6px; }
  .card p.sub { color: #555; font-size: .9rem; margin-bottom: 28px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-group { margin-bottom: 18px; }
  label { display: block; font-size: .88rem; color: #0a0a0a; margin-bottom: 5px; font-weight: 600; }
  input[type=text], input[type=email], input[type=password], select {
    width: 100%; padding: 11px 14px; border: 1.5px solid #cdd5e0; border-radius: 7px;
    font-size: .95rem; color: #0a0a0a; transition: border-color .2s;
  }
  input:focus, select:focus { outline: none; border-color: #185FA5; }
  .btn { width: 100%; padding: 12px; background: #185FA5; color: #fff; border: none; border-radius: 7px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background .2s; margin-top: 6px; }
  .btn:hover { background: #042C53; }
  .error { background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 18px; }
  .success { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; border-radius: 7px; padding: 10px 14px; font-size: .88rem; margin-bottom: 18px; }
  .login-link { text-align: center; margin-top: 20px; font-size: .88rem; color: #555; }
  .login-link a { color: #185FA5; font-weight: 600; text-decoration: none; }
  .login-link a:hover { text-decoration: underline; }
  footer { text-align: center; padding: 16px; font-size: .8rem; color: #888; background: #fff; border-top: 1px solid #e8ecf0; }
  .section-title { font-size: .8rem; text-transform: uppercase; letter-spacing: 1px; color: #185FA5; font-weight: 700; margin: 20px 0 12px; border-bottom: 1px solid #e0e8f0; padding-bottom: 6px; }
</style>
</head>
<body>
<header>
  <h1>PATHFIT Tracking System</h1>
  <span>Physical Activity Towards Health and Fitness</span>
</header>
<main>
  <div class="card">
    <h2>Create Account</h2>
    <p class="sub">Register as a student to access your fitness tracking portal.</p>

    <?php if ($error): ?>
      <div class="error"><?= $error ?></div>
    <?php endif; ?>
    <?php if ($success): ?>
      <div class="success"><?= $success ?></div>
    <?php endif; ?>

    <?php if (!$success): ?>
    <form method="POST" action="register.php">
      <div class="section-title">Personal Information</div>
      <div class="form-group">
        <label for="name">Full Name *</label>
        <input type="text" id="name" name="name" placeholder="Juan Dela Cruz"
               value="<?= htmlspecialchars($_POST['name'] ?? '') ?>" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="student_id">Student ID *</label>
          <input type="text" id="student_id" name="student_id" placeholder="2024-00001"
                 value="<?= htmlspecialchars($_POST['student_id'] ?? '') ?>" required>
        </div>
        <div class="form-group">
          <label for="gender">Gender *</label>
          <select id="gender" name="gender" required>
            <option value="">— Select —</option>
            <option value="male"   <?= (($_POST['gender'] ?? '') === 'male')   ? 'selected' : '' ?>>Male</option>
            <option value="female" <?= (($_POST['gender'] ?? '') === 'female') ? 'selected' : '' ?>>Female</option>
          </select>
        </div>
      </div>

      <div class="section-title">Academic Information</div>
      <div class="form-row">
        <div class="form-group">
          <label for="course">Course / Program *</label>
          <input type="text" id="course" name="course" placeholder="BSIT"
                 value="<?= htmlspecialchars($_POST['course'] ?? '') ?>" required>
        </div>
        <div class="form-group">
          <label for="section">Section Code *</label>
          <select id="section" name="section" required>
            <option value="">— Select —</option>
            <option value="A" <?= (($_POST['section'] ?? '') === 'A') ? 'selected' : '' ?>>A</option>
            <option value="B" <?= (($_POST['section'] ?? '') === 'B') ? 'selected' : '' ?>>B</option>
            <option value="C" <?= (($_POST['section'] ?? '') === 'C') ? 'selected' : '' ?>>C</option>
            <option value="D" <?= (($_POST['section'] ?? '') === 'D') ? 'selected' : '' ?>>D</option>
            <option value="E" <?= (($_POST['section'] ?? '') === 'E') ? 'selected' : '' ?>>E</option>
            <option value="F" <?= (($_POST['section'] ?? '') === 'F') ? 'selected' : '' ?>>F</option>
            <option value="G" <?= (($_POST['section'] ?? '') === 'G') ? 'selected' : '' ?>>G</option>
            <option value="H" <?= (($_POST['section'] ?? '') === 'H') ? 'selected' : '' ?>>H</option>
            <option value="I" <?= (($_POST['section'] ?? '') === 'I') ? 'selected' : '' ?>>I</option>
            <option value="J" <?= (($_POST['section'] ?? '') === 'J') ? 'selected' : '' ?>>J</option>
            <option value="K" <?= (($_POST['section'] ?? '') === 'K') ? 'selected' : '' ?>>K</option>
            <option value="L" <?= (($_POST['section'] ?? '') === 'L') ? 'selected' : '' ?>>L</option>
            <option value="M" <?= (($_POST['section'] ?? '') === 'M') ? 'selected' : '' ?>>M</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="year_level">Year Level *</label>
          <select id="year_level" name="year_level" required>
            <option value="">— Select —</option>
            <?php for ($y = 1; $y <= 5; $y++): ?>
              <option value="<?= $y ?>" <?= (($_POST['year_level'] ?? '') == $y) ? 'selected' : '' ?>>Year <?= $y ?></option>
            <?php endfor; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="pathfit_level">PATHFit Level *</label>
          <select id="pathfit_level" name="pathfit_level" required>
            <option value="">— Select —</option>
            <option value="1" <?= (($_POST['pathfit_level'] ?? '') == 1) ? 'selected' : '' ?>>PATHFit 1</option>
            <option value="2" <?= (($_POST['pathfit_level'] ?? '') == 2) ? 'selected' : '' ?>>PATHFit 2</option>
          </select>
        </div>
      </div>

      <div class="section-title">Account Credentials</div>
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input type="email" id="email" name="email" placeholder="you@school.edu.ph"
               value="<?= htmlspecialchars($_POST['email'] ?? '') ?>" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="password">Password *</label>
          <input type="password" id="password" name="password" placeholder="Min. 8 characters" required>
        </div>
        <div class="form-group">
          <label for="confirm_pass">Confirm Password *</label>
          <input type="password" id="confirm_pass" name="confirm_pass" placeholder="Repeat password" required>
        </div>
      </div>

      <button type="submit" class="btn">Create Account</button>
    </form>
    <?php endif; ?>

    <div class="login-link">Already have an account? <a href="login.php">Sign in</a></div>
  </div>
</main>
<footer>&copy; <?= date('Y') ?> PATHFIT Tracking System. All rights reserved.</footer>
</body>
</html>
