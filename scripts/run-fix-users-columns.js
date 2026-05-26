require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'fix_users_columns.sql'), 'utf8');
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const before = await admin.from('users').select('age').limit(1);
  if (!before.error) {
    console.log('age column already exists');
    return;
  }

  let pg;
  try { pg = require('pg'); } catch {
    console.log('Run fix_users_columns.sql manually in Supabase SQL Editor.');
    process.exit(1);
  }

  const cs = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!cs) {
    console.log('Add DATABASE_URL to .env then re-run, OR paste fix_users_columns.sql into Supabase SQL Editor.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();

  const after = await admin.from('users').select('age, course').limit(1);
  if (after.error) throw new Error(after.error.message);
  console.log('Migration OK. Sample row:', after.data[0]);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
