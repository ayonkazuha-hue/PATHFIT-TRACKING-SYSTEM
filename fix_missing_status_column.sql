-- ============================================================
-- FIX: Add missing 'status' column + approve ALL existing students
-- ============================================================
-- Run this in your Supabase SQL Editor.
-- This will make ALL registered students visible on the dashboard.
-- ============================================================

-- Step 1: Add the status column if it doesn't exist yet
-- (safe to run multiple times — IF NOT EXISTS prevents errors)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved'));

-- Step 2: Approve EVERY existing student — no exceptions
-- This fixes students who were stuck as 'pending' and not showing up
UPDATE public.users
SET status = 'approved'
WHERE role = 'student';

-- Step 3: Verify — ALL students should now show status = 'approved'
SELECT student_id, name, email, role, status, created_at
FROM public.users
WHERE role = 'student'
ORDER BY created_at DESC;
