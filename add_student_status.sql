-- Migration: Add approval status to users table
-- Run this in your Supabase SQL Editor

-- 1. Add the status column (defaults to 'approved' so existing students are unaffected)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved'));

-- 2. New student registrations will be set to 'pending' by the application.
--    Existing students keep 'approved' status automatically.

-- Optional: verify
-- SELECT user_id, name, email, role, status FROM users ORDER BY created_at DESC LIMIT 20;
