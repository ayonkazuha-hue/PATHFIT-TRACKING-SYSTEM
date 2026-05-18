

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS public.fitness_test_notifications (
    notif_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    test_id     UUID REFERENCES public.fitness_tests(test_id) ON DELETE CASCADE,
    test_type   VARCHAR(30) NOT NULL,
    test_period VARCHAR(10) NOT NULL,
    rating      VARCHAR(25),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE public.fitness_test_notifications ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop old policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "notif_service_all" ON public.fitness_test_notifications;

-- Step 4: Allow service_role full access (used by the Node.js server)
CREATE POLICY "notif_service_all" ON public.fitness_test_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Step 5: Verify the table was created
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fitness_test_notifications'
ORDER BY ordinal_position;
