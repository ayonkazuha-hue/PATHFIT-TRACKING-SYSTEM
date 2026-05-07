-- ============================================================
-- PATHFIT TRACKING SYSTEM — Account Setup
-- Run each BLOCK separately in Supabase SQL Editor
-- ============================================================


-- ══════════════════════════════════════════════════════════
-- BLOCK 1: Create INSTRUCTOR account (gpquiblat@nbsc.edu.ph)
-- ══════════════════════════════════════════════════════════

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'gpquiblat@nbsc.edu.ph',
  crypt('gpquiblat@123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "GP Quiblat"}',
  FALSE,
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO UPDATE
  SET encrypted_password = crypt('gpquiblat@123', gen_salt('bf')),
      email_confirmed_at = NOW(),
      updated_at = NOW();


-- ══════════════════════════════════════════════════════════
-- BLOCK 2: Create STUDENT test account (student@nbsc.edu.ph)
-- ══════════════════════════════════════════════════════════

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'student@nbsc.edu.ph',
  crypt('student@123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Test Student"}',
  FALSE,
  'authenticated',
  'authenticated',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO UPDATE
  SET encrypted_password = crypt('student@123', gen_salt('bf')),
      email_confirmed_at = NOW(),
      updated_at = NOW();


-- ══════════════════════════════════════════════════════════
-- BLOCK 3: Insert INSTRUCTOR profile into public.users
-- ══════════════════════════════════════════════════════════

INSERT INTO public.users (
  user_id,
  student_id,
  name,
  email,
  section,
  course,
  year_level,
  gender,
  pathfit_level,
  role
)
SELECT
  id,
  'INST-001',
  'GP Quiblat',
  'gpquiblat@nbsc.edu.ph',
  'N/A',
  'Physical Education',
  1,
  'male',
  1,
  'instructor'
FROM auth.users
WHERE email = 'gpquiblat@nbsc.edu.ph'
ON CONFLICT (user_id) DO UPDATE
  SET role         = 'instructor',
      name         = 'GP Quiblat',
      student_id   = 'INST-001';


-- ══════════════════════════════════════════════════════════
-- BLOCK 4: Insert STUDENT profile into public.users
-- ══════════════════════════════════════════════════════════

INSERT INTO public.users (
  user_id,
  student_id,
  name,
  email,
  section,
  course,
  year_level,
  gender,
  pathfit_level,
  role
)
SELECT
  id,
  '2024-00001',
  'Test Student',
  'student@nbsc.edu.ph',
  'A',
  'BSIT',
  1,
  'male',
  1,
  'student'
FROM auth.users
WHERE email = 'student@nbsc.edu.ph'
ON CONFLICT (user_id) DO UPDATE
  SET role       = 'student',
      name       = 'Test Student',
      student_id = '2024-00001';


-- ══════════════════════════════════════════════════════════
-- BLOCK 5: Add health screening for test student
--          (skips the health screening gate on first login)
-- ══════════════════════════════════════════════════════════

INSERT INTO public.health_screening (
  student_id,
  injury_history,
  health_conditions,
  cleared
)
SELECT
  u.user_id,
  'None',
  'None of the above',
  TRUE
FROM public.users u
WHERE u.email = 'student@nbsc.edu.ph'
ON CONFLICT (student_id) DO UPDATE
  SET cleared = TRUE;


-- ══════════════════════════════════════════════════════════
-- BLOCK 6: VERIFY — Run this to confirm everything is correct
-- ══════════════════════════════════════════════════════════

SELECT
  u.name,
  u.email,
  u.role,
  u.student_id,
  u.pathfit_level,
  CASE
    WHEN a.email_confirmed_at IS NOT NULL THEN 'YES - Ready to login'
    ELSE 'NO - Not confirmed'
  END AS can_login,
  CASE
    WHEN hs.screen_id IS NOT NULL THEN 'YES'
    ELSE 'NO'
  END AS health_screening_done
FROM public.users u
JOIN auth.users a ON a.id = u.user_id
LEFT JOIN public.health_screening hs ON hs.student_id = u.user_id
ORDER BY u.role DESC;
