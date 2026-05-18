
UPDATE public.users
SET role = 'instructor'
WHERE email = 'gpquiblat@nbsc.edu.ph';

UPDATE public.users
SET role = 'student'
WHERE email != 'gpquiblat@nbsc.edu.ph';

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
