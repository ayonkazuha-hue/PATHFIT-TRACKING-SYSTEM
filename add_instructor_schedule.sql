-- Faculty teaching load schedules (multiple rows — one block per instructor name)
CREATE TABLE IF NOT EXISTS instructor_schedules (
    schedule_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    display_name   VARCHAR(150) NOT NULL DEFAULT 'INSTRUCTOR NAME',
    semester_label VARCHAR(250) NOT NULL DEFAULT 'SY 2026-2027 1st Semester (PATHFIT 1 & 3 FACULTY TEACHING LOAD)',
    schedule_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
    deload_units   TEXT DEFAULT '',
    regular_load   TEXT DEFAULT '',
    overload       TEXT DEFAULT '',
    total_units    VARCHAR(20) DEFAULT '',
    is_locked      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order     INT NOT NULL DEFAULT 0,
    updated_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_schedules_sort
    ON instructor_schedules(sort_order, created_at);

ALTER TABLE instructor_schedules ENABLE ROW LEVEL SECURITY;
