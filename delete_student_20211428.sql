-- ============================================================
-- Delete student account: 20211428@nbsc.edu.ph
-- and all related records (health appraisal, fitness tests, etc.)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Get the user_id for reference
DO $$
DECLARE
  v_user_id UUID;
  v_auth_id UUID;
BEGIN
  -- Find user_id from the users table
  SELECT user_id INTO v_user_id
  FROM public.users
  WHERE email = '20211428@nbsc.edu.ph';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found with email 20211428@nbsc.edu.ph';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user_id: %', v_user_id;

  -- Step 2: Delete all related records (CASCADE handles most, but explicit for safety)

  -- Health appraisal notifications
  DELETE FROM public.health_appraisal_notifications WHERE student_id = v_user_id;
  RAISE NOTICE 'Deleted health appraisal notifications';

  -- Health appraisal record
  DELETE FROM public.health_appraisal_record WHERE student_id = v_user_id;
  RAISE NOTICE 'Deleted health appraisal record';

  -- Fitness test notifications
  DELETE FROM public.fitness_test_notifications WHERE student_id = v_user_id;
  RAISE NOTICE 'Deleted fitness test notifications';

  -- Fitness tests
  DELETE FROM public.fitness_tests WHERE student_id = v_user_id;
  RAISE NOTICE 'Deleted fitness tests';

  -- Fitness portfolio
  DELETE FROM public.fitness_portfolio WHERE student_id = v_user_id;
  RAISE NOTICE 'Deleted fitness portfolio';

  -- Password reset requests
  DELETE FROM public.password_reset_requests WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted password reset requests';

  -- Delete the user profile
  DELETE FROM public.users WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted user profile';

  RAISE NOTICE 'All records for 20211428@nbsc.edu.ph have been deleted.';
END $$;

-- Step 3: Delete the auth user (removes login credentials)
-- Find the auth user ID and delete it
DELETE FROM auth.users WHERE email = '20211428@nbsc.edu.ph';

-- Step 4: Verify deletion
SELECT COUNT(*) AS remaining_records
FROM public.users
WHERE email = '20211428@nbsc.edu.ph';
