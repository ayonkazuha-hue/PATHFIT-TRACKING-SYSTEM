-- Ensure the live fitness_tests table includes hr_before for step test records
ALTER TABLE public.fitness_tests
  ADD COLUMN IF NOT EXISTS hr_before NUMERIC(6,1);

-- Verify that the column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fitness_tests'
  AND column_name = 'hr_before';
