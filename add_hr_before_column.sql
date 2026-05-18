

ALTER TABLE public.fitness_tests
  ADD COLUMN IF NOT EXISTS hr_before NUMERIC(6,1);

-- Also update the test_type constraint to include step_test_3min
ALTER TABLE public.fitness_tests
  DROP CONSTRAINT IF EXISTS fitness_tests_test_type_check;

ALTER TABLE public.fitness_tests
  ADD CONSTRAINT fitness_tests_test_type_check
  CHECK (test_type IN ('push_ups','sit_reach','zipper_test','juggling','sprint_40m','step_test_3min'));

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'fitness_tests' ORDER BY ordinal_position;
