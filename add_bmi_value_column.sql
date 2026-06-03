-- ============================================================
-- Add bmi_value column to health_appraisal_record table
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE public.health_appraisal_record
  ADD COLUMN IF NOT EXISTS bmi_value DECIMAL(5,2);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'health_appraisal_record'
ORDER BY ordinal_position;
