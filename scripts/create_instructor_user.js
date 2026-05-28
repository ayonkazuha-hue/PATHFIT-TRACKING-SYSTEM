require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { probeUsersSchema, buildUserProfileInsert } = require('../utils/usersSchema');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const nameArg = process.argv[4] || '';

  if (!email || !password) {
    console.error('Usage: node scripts/create_instructor_user.js <email> <password> [name]');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, serviceKey);

  await probeUsersSchema(supabaseAdmin, { refresh: true });

  const emailLower = String(email).toLowerCase().trim();
  const name =
    String(nameArg).trim() ||
    emailLower.split('@')[0].replace(/[._-]+/g, ' ').trim().slice(0, 80) ||
    'Instructor';

  // Check existing profile
  const { data: existingProfile, error: existingErr } = await supabaseAdmin
    .from('users')
    .select('user_id,email,role')
    .eq('email', emailLower)
    .maybeSingle();

  if (existingErr) {
    console.error('Error checking existing profile:', existingErr.message);
    process.exit(1);
  }

  // Create (or update) auth user
  let uid = existingProfile?.user_id || null;

  async function findAuthUserIdByEmail(targetEmail) {
    const normalized = String(targetEmail).toLowerCase().trim();
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users || [];
      const hit = users.find((u) => String(u.email || '').toLowerCase().trim() === normalized);
      if (hit?.id) return hit.id;
      if (users.length < perPage) return null;
      page += 1;
    }
  }

  if (!uid) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
    });
    if (authErr || !authData?.user?.id) {
      // If auth user already exists, fetch it by email then proceed as update
      const existsUid = await findAuthUserIdByEmail(emailLower);
      if (!existsUid) {
        console.error('Auth createUser failed:', authErr?.message || 'Unknown error');
        process.exit(1);
      }
      uid = existsUid;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(uid, { password });
      if (updErr) {
        console.error('Auth updateUserById failed:', updErr.message);
        process.exit(1);
      }
    } else {
      uid = authData.user.id;
    }
  } else {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(uid, { password });
    if (updErr) {
      console.error('Auth updateUserById failed:', updErr.message);
      process.exit(1);
    }
  }

  // Upsert profile row
  const profileRow = buildUserProfileInsert({
    user_id: uid,
    name,
    email: emailLower,
    role: 'instructor',
    student_id: null,
    section: null,
    course: null,
    gender: null,
    year_level: null,
    pathfit_level: null,
    age: null,
    status: 'approved',
  });

  const { error: upsertErr } = await supabaseAdmin
    .from('users')
    .upsert(profileRow, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('Profile upsert failed:', upsertErr.message);
    process.exit(1);
  }

  console.log('OK:', { email: emailLower, user_id: uid, role: 'instructor' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

