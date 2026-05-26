-- Run once in Supabase SQL Editor (fixes age + status on users table)
-- Fixes: "Could not find the 'age' column of 'users' in the schema cache"

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age SMALLINT CHECK (age BETWEEN 1 AND 120);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';

UPDATE public.users
SET status = 'approved'
WHERE role = 'student' AND (status IS NULL OR status = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'approved';

-- Optional: callable from app after this script has been run once
CREATE OR REPLACE FUNCTION public.ensure_users_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age SMALLINT CHECK (age BETWEEN 1 AND 120);
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
  UPDATE public.users SET status = 'approved' WHERE role = 'student' AND status IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_users_schema() TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
