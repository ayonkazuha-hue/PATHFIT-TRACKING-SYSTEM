ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved'));

UPDATE public.users
SET status = 'approved'
WHERE role = 'student';


SELECT student_id, name, email, role, status, created_at
FROM public.users
WHERE role = 'student'
ORDER BY created_at DESC;
