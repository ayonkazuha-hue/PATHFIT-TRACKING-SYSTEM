-- ============================================================
-- Create Supabase Storage buckets
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Create 'modules' bucket as public
INSERT INTO storage.buckets (id, name, public)
VALUES ('modules', 'modules', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 2: Drop old policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Public read access for modules"           ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to modules" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to modules"       ON storage.objects;

-- Step 3: Allow anyone to read/download files from the modules bucket
CREATE POLICY "Public read access for modules"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'modules');

-- Step 4: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to modules"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'modules' AND auth.role() = 'authenticated');

-- Step 5: Allow service role full access (server-side uploads from Node.js)
CREATE POLICY "Service role full access to modules"
  ON storage.objects FOR ALL
  USING (bucket_id = 'modules' AND auth.role() = 'service_role');

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'modules';
