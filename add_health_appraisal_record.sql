-- ============================================================
-- Health Appraisal Record (PAR-Q) Migration
-- Replaces the simple health_screening table with comprehensive PAR-Q form
-- ============================================================

-- Drop the old health_screening table if it exists
DROP TABLE IF EXISTS health_screening CASCADE;

-- Create the new health_appraisal_record table
CREATE TABLE health_appraisal_record (
  record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- I. Personal Data
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  age INTEGER NOT NULL,
  
  -- II. Physical Check-up Result
  height_kg DECIMAL(5,2),
  weight_cm DECIMAL(5,2),
  resting_pulse_rate INTEGER,
  waistline_inches DECIMAL(5,2),
  ideal_weight VARCHAR(50),
  bmi_classification VARCHAR(50),
  
  -- III. Medical-related Questionnaire
  q1_hospitalization BOOLEAN DEFAULT FALSE,
  q1_details TEXT,
  
  q2_injury BOOLEAN DEFAULT FALSE,
  q2_details TEXT,
  
  q3_diagnosed BOOLEAN DEFAULT FALSE,
  q3_1_chest_pain BOOLEAN DEFAULT FALSE,
  q3_2_breathing BOOLEAN DEFAULT FALSE,
  q3_3_dizziness BOOLEAN DEFAULT FALSE,
  q3_4_hypertension BOOLEAN DEFAULT FALSE,
  q3_5_anemia BOOLEAN DEFAULT FALSE,
  q3_6_kidney BOOLEAN DEFAULT FALSE,
  q3_7_arthritis BOOLEAN DEFAULT FALSE,
  q3_8_gout BOOLEAN DEFAULT FALSE,
  q3_9_dislocation BOOLEAN DEFAULT FALSE,
  q3_10_fracture BOOLEAN DEFAULT FALSE,
  
  q4_lower_back_pain BOOLEAN DEFAULT FALSE,
  q5_movement_restriction BOOLEAN DEFAULT FALSE,
  q6_medical_treatment BOOLEAN DEFAULT FALSE,
  
  q7_regular_exercise BOOLEAN DEFAULT FALSE,
  q7_details TEXT,
  
  q8_smoke BOOLEAN DEFAULT FALSE,
  q8_details TEXT,
  
  q9_alcohol BOOLEAN DEFAULT FALSE,
  q9_details TEXT,
  
  -- Certification
  certify_correctness BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  cleared BOOLEAN DEFAULT FALSE,
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES users(user_id),
  
  UNIQUE(student_id)
);

-- Create index for faster lookups
CREATE INDEX idx_health_appraisal_student ON health_appraisal_record(student_id);
CREATE INDEX idx_health_appraisal_cleared ON health_appraisal_record(cleared);

-- Grant permissions
ALTER TABLE health_appraisal_record ENABLE ROW LEVEL SECURITY;

-- Students can only view/insert their own record
CREATE POLICY "Students can view own health appraisal"
  ON health_appraisal_record FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own health appraisal"
  ON health_appraisal_record FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Instructors can view and update all records
CREATE POLICY "Instructors can view all health appraisals"
  ON health_appraisal_record FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'instructor'
    )
  );

CREATE POLICY "Instructors can update health appraisals"
  ON health_appraisal_record FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'instructor'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Health Appraisal Record (PAR-Q) table created successfully!';
  RAISE NOTICE '→ Old health_screening table has been replaced.';
  RAISE NOTICE '→ Students will now fill out the comprehensive PAR-Q form.';
END $$;
