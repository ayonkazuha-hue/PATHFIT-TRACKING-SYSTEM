-- ============================================================
-- COMPLETE HEALTH APPRAISAL SETUP
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- then click RUN
-- ============================================================

-- Step 1: Drop old tables
DROP TABLE IF EXISTS health_appraisal_notifications CASCADE;
DROP TABLE IF EXISTS health_appraisal_record CASCADE;
DROP TABLE IF EXISTS health_screening CASCADE;

-- Step 2: Create health_appraisal_record
CREATE TABLE health_appraisal_record (
  record_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               UUID NOT NULL CONSTRAINT fk_har_student REFERENCES users(user_id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  gender                   VARCHAR(10) NOT NULL,
  age                      INTEGER NOT NULL,
  height_kg                DECIMAL(5,2),
  weight_cm                DECIMAL(5,2),
  resting_pulse_rate       INTEGER,
  waistline_inches         DECIMAL(5,2),
  ideal_weight             VARCHAR(50),
  bmi_classification       VARCHAR(50),
  q1_hospitalization       BOOLEAN DEFAULT FALSE,
  q1_details               TEXT,
  q2_injury                BOOLEAN DEFAULT FALSE,
  q2_details               TEXT,
  q3_diagnosed             BOOLEAN DEFAULT FALSE,
  q3_1_chest_pain          BOOLEAN DEFAULT FALSE,
  q3_2_breathing           BOOLEAN DEFAULT FALSE,
  q3_3_dizziness           BOOLEAN DEFAULT FALSE,
  q3_4_hypertension        BOOLEAN DEFAULT FALSE,
  q3_5_anemia              BOOLEAN DEFAULT FALSE,
  q3_6_kidney              BOOLEAN DEFAULT FALSE,
  q3_7_arthritis           BOOLEAN DEFAULT FALSE,
  q3_8_gout                BOOLEAN DEFAULT FALSE,
  q3_9_dislocation         BOOLEAN DEFAULT FALSE,
  q3_10_fracture           BOOLEAN DEFAULT FALSE,
  q4_lower_back_pain       BOOLEAN DEFAULT FALSE,
  q5_movement_restriction  BOOLEAN DEFAULT FALSE,
  q6_medical_treatment     BOOLEAN DEFAULT FALSE,
  q7_regular_exercise      BOOLEAN DEFAULT FALSE,
  q7_details               TEXT,
  q8_smoke                 BOOLEAN DEFAULT FALSE,
  q8_details               TEXT,
  q9_alcohol               BOOLEAN DEFAULT FALSE,
  q9_details               TEXT,
  certify_correctness      BOOLEAN DEFAULT FALSE,
  submitted_at             TIMESTAMPTZ DEFAULT NOW(),
  cleared                  BOOLEAN DEFAULT FALSE,
  cleared_at               TIMESTAMPTZ,
  cleared_by               UUID CONSTRAINT fk_har_cleared_by REFERENCES users(user_id) ON DELETE SET NULL,
  photo_url                TEXT,
  UNIQUE(student_id)
);

-- Step 3: Indexes
CREATE INDEX idx_har_student ON health_appraisal_record(student_id);
CREATE INDEX idx_har_cleared  ON health_appraisal_record(cleared);

-- Step 4: Enable RLS
ALTER TABLE health_appraisal_record ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for health_appraisal_record
CREATE POLICY "service_role full access har"
  ON health_appraisal_record FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "student select own har"
  ON health_appraisal_record FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "student insert own har"
  ON health_appraisal_record FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

-- Step 6: Create health_appraisal_notifications
CREATE TABLE health_appraisal_notifications (
  notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL CONSTRAINT fk_han_student REFERENCES users(user_id) ON DELETE CASCADE,
  record_id        UUID NOT NULL CONSTRAINT fk_han_record  REFERENCES health_appraisal_record(record_id) ON DELETE CASCADE,
  is_read          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id)
);

-- Step 7: Indexes
CREATE INDEX idx_han_read    ON health_appraisal_notifications(is_read);
CREATE INDEX idx_han_created ON health_appraisal_notifications(created_at DESC);

-- Step 8: Enable RLS
ALTER TABLE health_appraisal_notifications ENABLE ROW LEVEL SECURITY;

-- Step 9: RLS Policies for health_appraisal_notifications
CREATE POLICY "service_role full access han"
  ON health_appraisal_notifications FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "student insert own han"
  ON health_appraisal_notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

SELECT 'Setup complete! Both tables created successfully.' AS result;
