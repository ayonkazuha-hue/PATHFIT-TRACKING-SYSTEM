const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data, error } = await supabase.from('sections').select('section_id').limit(1);
  if (error) {
    console.error('Error fetching sections:', error);
  } else {
    console.log('Sections fetched successfully:', data);
  }
}
test();
