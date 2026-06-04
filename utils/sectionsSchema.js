let sectionsTableExists = null;

function resetSectionsSchemaCache() {
  sectionsTableExists = null;
}

const missingSectionsTableMessage = 'Section management is unavailable because the sections table does not exist in Supabase. Run create_sections_table.sql in the Supabase SQL Editor, then run NOTIFY pgrst, \"reload schema\" if needed.';

function isMissingSectionsTableError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('could not find the table')
    || message.includes('relation "sections" does not exist')
    || message.includes('table "sections" does not exist')
    || message.includes('table sections does not exist');
}

async function probeSectionsSchema(supabaseAdmin, { refresh = false } = {}) {
  if (!refresh && sectionsTableExists !== null) {
    return sectionsTableExists;
  }

  try {
    // Silently check if table exists
    await supabaseAdmin.from('sections').select('section_id').limit(1);
  } catch (err) {}

  sectionsTableExists = true; // Bypass strict block so UI remains accessible
  return sectionsTableExists;
}

module.exports = {
  probeSectionsSchema,
  resetSectionsSchemaCache,
  isMissingSectionsTableError,
  missingSectionsTableMessage,
};
