CREATE TABLE IF NOT EXISTS password_reset_requests (
    request_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    new_password TEXT NOT NULL,          -- temporarily stored (plain); cleared after action
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','declined')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ
);

-- Only the service role (used by supabaseAdmin) can read/write this table
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON password_reset_requests USING (false);
