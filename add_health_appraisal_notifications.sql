CREATE TABLE IF NOT EXISTS health_appraisal_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES health_appraisal_record(record_id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(record_id)
);

-- Create index for faster lookups
CREATE INDEX idx_health_appraisal_notif_read ON health_appraisal_notifications(is_read);
CREATE INDEX idx_health_appraisal_notif_created ON health_appraisal_notifications(created_at DESC);

-- Grant permissions
ALTER TABLE health_appraisal_notifications ENABLE ROW LEVEL SECURITY;

-- Instructors can view all notifications
CREATE POLICY "Instructors can view health appraisal notifications"
  ON health_appraisal_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'instructor'
    )
  );

-- Instructors can update notifications (mark as read)
CREATE POLICY "Instructors can update health appraisal notifications"
  ON health_appraisal_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'instructor'
    )
  );

-- Students can insert their own notifications
CREATE POLICY "Students can insert health appraisal notifications"
  ON health_appraisal_notifications FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Health Appraisal Notifications table created successfully!';
  RAISE NOTICE '→ Instructors will now be notified when students submit PAR-Q forms.';
END $$;
