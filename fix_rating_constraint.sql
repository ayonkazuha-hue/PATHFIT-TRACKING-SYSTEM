-- Fix the fitness_tests.rating constraint to allow all generated rating values
ALTER TABLE public.fitness_tests
  DROP CONSTRAINT IF EXISTS fitness_tests_rating_check;

ALTER TABLE public.fitness_tests
  ADD CONSTRAINT fitness_tests_rating_check
  CHECK (rating IN ('excellent','very_good','good','fair','needs_improvement','poor'));

-- Verify current constraint definition
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.fitness_tests'::regclass
  AND contype = 'c';
