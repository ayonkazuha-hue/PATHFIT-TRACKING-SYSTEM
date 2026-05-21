const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function removeWeek16() {
  const { error } = await supabaseAdmin.from('lesson_plans').delete().eq('week_number', 16);
  if (error) {
    console.error('Error removing week 16:', error);
  } else {
    console.log('Successfully removed Week 16 from lesson_plans table.');
  }
}

removeWeek16();
