-- Allow multiple teaching-load schedules with editable display names
ALTER TABLE instructor_schedules
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(user_id);

ALTER TABLE instructor_schedules DROP CONSTRAINT IF EXISTS instructor_schedules_instructor_id_key;

ALTER TABLE instructor_schedules
    ALTER COLUMN instructor_id DROP NOT NULL;

UPDATE instructor_schedules s
SET display_name = COALESCE(NULLIF(TRIM(s.display_name), ''), u.name, 'INSTRUCTOR NAME')
FROM users u
WHERE s.instructor_id = u.user_id
  AND (s.display_name IS NULL OR TRIM(s.display_name) = '');

UPDATE instructor_schedules
SET display_name = 'INSTRUCTOR NAME'
WHERE display_name IS NULL OR TRIM(display_name) = '';

ALTER TABLE instructor_schedules
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_instructor_schedules_sort
    ON instructor_schedules(sort_order, created_at);
