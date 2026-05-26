-- PATHFIT Instructor Features — Database Checklist
-- Run in Supabase SQL Editor (in order). Safe to re-run (uses IF NOT EXISTS where possible).

-- 1. Core users columns (registration approval + age for step-test ratings)
--    Run: fix_users_columns.sql
--    Or locally: npm run db:fix-users  (requires DATABASE_URL in .env)

-- 2. Health Appraisal (PAR-Q) — required for /instructor/health-appraisal
--    Use SETUP_HEALTH_APPRAISAL.sql (full setup) OR add_health_appraisal_record.sql + add_health_appraisal_notifications.sql

-- 3. Fitness test notifications (bell alerts when students submit tests)
--    Run: add_fitness_notifications.sql

-- 4. Password reset approval queue
--    Run: add_password_reset_table.sql

-- 5. Fitness test rating constraint (allows very_good, poor, etc.)
--    Run: fix_rating_constraint.sql

-- 6. Optional: hr_before column on fitness_tests (3-min step test)
--    Run: add_hr_before_column.sql

-- 7. Optional: student photo on health appraisal
--    Run: add_health_appraisal_photo.sql

-- ── Verify all instructor tables exist ───────────────────────
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
    'password_reset_requests'
  )
ORDER BY table_name;

-- ── Verify users columns ───────────────────────────────────
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
  AND column_name IN ('age', 'status')
ORDER BY column_name;

NOTIFY pgrst, 'reload schema';
