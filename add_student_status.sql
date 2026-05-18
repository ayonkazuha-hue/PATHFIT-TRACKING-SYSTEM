
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved'));
