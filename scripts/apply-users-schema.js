/**
 * Applies missing users table columns (age, status) to Supabase.
 * Usage:
 *   node scripts/apply-users-schema.js
 * Requires DATABASE_URL in .env (Supabase → Settings → Database → Connection string → URI)
 */
require('dotenv').config();

const SQL = `
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age SMALLINT CHECK (age BETWEEN 1 AND 120);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';

UPDATE public.users SET status = 'approved' WHERE role = 'student' AND status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'approved';
`;

async function withPg() {
  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg first: npm install pg');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('\nMissing DATABASE_URL in .env');
    console.error('Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)\n');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log('✓ users.age and users.status columns applied successfully.');
}

async function verify(supabaseAdmin) {
  const { error } = await supabaseAdmin.from('users').select('age, status').limit(1);
  if (error) throw new Error(error.message);
  console.log('✓ Verified: age and status columns are available.');
}

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const probe = await supabaseAdmin.from('users').select('age').limit(1);
  if (!probe.error) {
    console.log('✓ age column already exists — nothing to do.');
    return;
  }

  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
    await withPg();
    await verify(supabaseAdmin);
    return;
  }

  console.error('\nThe users.age column is missing in your Supabase database.\n');
  console.error('Option A — run SQL in Supabase SQL Editor (copy from fix_users_columns.sql)');
  console.error('Option B — add DATABASE_URL to .env, then run: node scripts/apply-users-schema.js\n');
  process.exit(1);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
