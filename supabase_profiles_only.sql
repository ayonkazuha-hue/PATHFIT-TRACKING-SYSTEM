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
  SET role = 'instructor';


-- STEP 2: Create student profile

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
  SET role = 'student';


-- STEP 3: Add health screening for student
-- (so they are not blocked by the health screening gate on first login)

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
WHERE email = 'student@nbsc.edu.ph'
ON CONFLICT (student_id) DO UPDATE
  SET cleared = TRUE;


-- STEP 4: Verify — you should see both accounts listed

SELECT
  u.name,
  u.email,
  u.role,
  u.student_id,
  u.pathfit_level,
  CASE WHEN a.email_confirmed_at IS NOT NULL
       THEN 'YES - Ready to login'
       ELSE 'NO - Not confirmed'
  END AS can_login,
  CASE WHEN hs.screen_id IS NOT NULL
       THEN 'YES' ELSE 'NO'
  END AS health_screening
FROM public.users u
JOIN auth.users a ON a.id = u.user_id
LEFT JOIN public.health_screening hs ON hs.student_id = u.user_id
ORDER BY u.role DESC;
