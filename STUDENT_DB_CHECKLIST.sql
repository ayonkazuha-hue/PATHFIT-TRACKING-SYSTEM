-- PATHFIT Student Features — Database Checklist
-- Run in Supabase SQL Editor (in order). Safe to re-run where scripts use IF NOT EXISTS.

-- 1. Users: age (step-test ratings) + status (registration approval)
--    Run: fix_users_columns.sql  |  Local: npm run db:fix-users

-- 2. Health Appraisal (PAR-Q) — required before student dashboard after login
--    Run: SETUP_HEALTH_APPRAISAL.sql (recommended)
--    Or: add_health_appraisal_record.sql + add_health_appraisal_notifications.sql

-- 3. Fitness test rating constraint (very_good, poor, etc.)
--    Run: fix_rating_constraint.sql

-- 4. Step test: hr_before column + step_test_3min in test_type constraint
--    Run: add_hr_before_column.sql

-- 5. Instructor notifications when students submit tests
--    Run: add_fitness_notifications.sql

-- 6. Password reset (forgot password flow)
--    Run: add_password_reset_table.sql

-- 7. Optional: student photo on health appraisal
--    Run: add_health_appraisal_photo.sql

-- ── Verify student-facing tables ─────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'fitness_tests',
    'lesson_plans',
    'health_appraisal_record',
    'health_appraisal_notifications',
    'fitness_test_notifications',
    'fitness_portfolio',
    'password_reset_requests'
  )
ORDER BY table_name;

-- ── Verify key columns ───────────────────────────────────────
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'users' AND column_name IN ('age', 'status'))
    OR (table_name = 'fitness_tests' AND column_name = 'hr_before')
  )
ORDER BY table_name, column_name;

NOTIFY pgrst, 'reload schema';
