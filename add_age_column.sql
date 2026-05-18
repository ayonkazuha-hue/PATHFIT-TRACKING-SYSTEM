-- ============================================================
-- Add age column to users table
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age SMALLINT CHECK (age BETWEEN 1 AND 120);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' ORDER BY ordinal_position;
