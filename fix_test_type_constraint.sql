ALTER TABLE public.fitness_tests
  DROP CONSTRAINT IF EXISTS fitness_tests_test_type_check;

-- Step 2: Add the new constraint with all current test types
ALTER TABLE public.fitness_tests
  ADD CONSTRAINT fitness_tests_test_type_check
  CHECK (test_type IN (
    'push_ups',
    'sit_reach',
    'zipper_test',
    'juggling',
    'sprint_40m',
    'stork_balance',
    'stick_drop',
    'agility_test',
    'step_test_3min'
  ));

-- Step 3: Verify
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.fitness_tests'::regclass
  AND contype = 'c';
