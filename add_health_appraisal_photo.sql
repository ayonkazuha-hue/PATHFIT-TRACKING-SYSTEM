ALTER TABLE health_appraisal_record
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN health_appraisal_record.photo_url IS 'Public URL of the student 2x2 photo uploaded during health appraisal.';
