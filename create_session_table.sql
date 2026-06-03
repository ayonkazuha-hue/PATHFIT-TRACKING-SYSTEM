-- ============================================================
-- Create user_sessions table for persistent sessions on Vercel
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  sid    TEXT PRIMARY KEY,
  sess   JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON public.user_sessions (expire);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the Node.js server)
DROP POLICY IF EXISTS "Service role manages sessions" ON public.user_sessions;
CREATE POLICY "Service role manages sessions"
  ON public.user_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Verify
SELECT COUNT(*) AS session_count FROM public.user_sessions;
