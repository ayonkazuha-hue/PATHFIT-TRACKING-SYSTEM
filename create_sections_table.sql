-- ============================================================
-- Create sections table for instructor-managed section codes
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sections (
  section_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sections_service_all"  ON public.sections;
DROP POLICY IF EXISTS "sections_public_read"  ON public.sections;

-- Service role full access (used by the Node.js server)
CREATE POLICY "sections_service_all" ON public.sections
  FOR ALL USING (auth.role() = 'service_role');

-- Anyone can read (needed for the student registration form)
CREATE POLICY "sections_public_read" ON public.sections
  FOR SELECT USING (true);

-- Verify
SELECT * FROM public.sections ORDER BY code;
