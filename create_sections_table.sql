-- ============================================================
-- Create sections table for instructor-managed section codes
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sections (
  section_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "sections_service_all" ON public.sections;
CREATE POLICY "sections_service_all" ON public.sections
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read sections (for the registration form)
DROP POLICY IF EXISTS "sections_public_read" ON public.sections;
CREATE POLICY "sections_public_read" ON public.sections
  FOR SELECT USING (true);

-- Seed with some default sections (instructor can delete/add more)
INSERT INTO public.sections (code, description) VALUES
  ('A', 'Section A'),
  ('B', 'Section B'),
  ('C', 'Section C')
ON CONFLICT (code) DO NOTHING;

SELECT * FROM public.sections ORDER BY code;
