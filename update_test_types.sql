-- ============================================================
-- Update fitness_tests.test_type constraint
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop the old constraint and add the new one with updated test types
ALTER TABLE public.fitness_tests
  DROP CONSTRAINT IF EXISTS fitness_tests_test_type_check;

ALTER TABLE public.fitness_tests
  ADD CONSTRAINT fitness_tests_test_type_check
  CHECK (test_type IN ('push_ups','sit_reach','zipper_test','juggling','sprint_40m','stork_balance','stick_drop','agility_test','step_test_3min'));

-- Verify
SELECT DISTINCT test_type FROM public.fitness_tests ORDER BY test_type;
