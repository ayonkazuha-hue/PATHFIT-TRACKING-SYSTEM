-- Creates a system_settings table to store application configurations
-- like the dynamic fitness test scoring rubrics.

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS but allow authenticated users to read (assuming service role manages writes)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access on system_settings"
    ON system_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- (Writes to this table will be handled by the Supabase Service Role key in the Node backend)
