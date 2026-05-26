-- Allow archiving students (hidden from active dashboard lists)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'approved', 'archived'));
