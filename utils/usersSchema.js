let usersHasAgeColumn = null;
let usersHasStatusColumn = null;

function resetSchemaCache() {
  usersHasAgeColumn = null;
  usersHasStatusColumn = null;
}

function parseAgeValue(age) {
  if (age === undefined || age === null || String(age).trim() === '') return null;
  const n = parseInt(String(age).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

async function probeUsersSchema(supabaseAdmin, { refresh = false } = {}) {
  if (!refresh && usersHasAgeColumn !== null) {
    return { age: usersHasAgeColumn, status: usersHasStatusColumn };
  }

  const ageProbe = await supabaseAdmin.from('users').select('age').limit(1);
  usersHasAgeColumn = !ageProbe.error;

  const statusProbe = await supabaseAdmin.from('users').select('status').limit(1);
  usersHasStatusColumn = !statusProbe.error;

  if (!usersHasAgeColumn) {
    const { error: rpcErr } = await supabaseAdmin.rpc('ensure_users_schema');
    if (!rpcErr) {
      resetSchemaCache();
      return probeUsersSchema(supabaseAdmin, { refresh: true });
    }
    console.warn(
      '[schema] users.age column is missing. Run fix_users_columns.sql in Supabase SQL Editor,',
      'or: npm run db:fix-users (with DATABASE_URL in .env)'
    );
  }
  return { age: usersHasAgeColumn, status: usersHasStatusColumn };
}

function buildUserProfileUpdate(fields) {
  const {
    name, student_id, email, section, course,
    year_level, gender, pathfit_level, age,
  } = fields;

  const updates = {
    name:          name.trim(),
    student_id:    student_id ? student_id.trim() : null,
    email:         email.trim(),
    section:       section       || null,
    course:        course        || null,
    year_level:    year_level    ? parseInt(year_level, 10)    : null,
    gender:        gender        || null,
    pathfit_level: pathfit_level ? parseInt(pathfit_level, 10) : null,
  };

  if (usersHasAgeColumn) {
    updates.age = parseAgeValue(age);
  }

  return updates;
}

function buildUserProfileInsert(fields) {
  const row = { ...fields };
  if (!usersHasAgeColumn) delete row.age;
  if (!usersHasStatusColumn) delete row.status;
  return row;
}

module.exports = {
  probeUsersSchema,
  buildUserProfileUpdate,
  buildUserProfileInsert,
  resetSchemaCache,
  parseAgeValue,
  get usersHasAgeColumn() { return usersHasAgeColumn; },
  get usersHasStatusColumn() { return usersHasStatusColumn; },
};
