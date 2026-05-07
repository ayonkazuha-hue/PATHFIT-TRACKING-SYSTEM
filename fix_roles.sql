-- ============================================================
-- PATHFIT — Fix Roles After Registration
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Set instructor role for admin account
UPDATE public.users
SET role = 'instructor'
WHERE email = 'gpquiblat@nbsc.edu.ph';

-- STEP 2: Make sure student role is correct
UPDATE public.users
SET role = 'student'
WHERE email != 'gpquiblat@nbsc.edu.ph';

-- STEP 3: Add health screening for all students
-- (so they skip the health screening gate)
INSERT INTO public.health_screening (
  student_id,
  injury_history,
  health_conditions,
  cleared
)
SELECT
  user_id,
  'None',
  'None of the above',
  TRUE
FROM public.users
WHERE role = 'student'
ON CONFLICT (student_id) DO UPDATE
  SET cleared = TRUE;

-- STEP 4: Verify — check all accounts and their roles
SELECT
  name,
  email,
  role,
  student_id,
  section,
  pathfit_level,
  created_at
FROM public.users
ORDER BY role DESC, name ASC;
