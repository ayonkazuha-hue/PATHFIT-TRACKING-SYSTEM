const fs = require('fs');

const BUCKET_NAME = 'system_data';
const FILE_NAME = 'managed_sections.json';

// Helper to ensure bucket exists
async function ensureBucket(supabaseAdmin) {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (!listError && Array.isArray(buckets) && buckets.some(b => b.name === BUCKET_NAME)) {
      return true;
    }
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: false });
  } catch (err) {
    // ignore
  }
}

async function getManagedSections(supabaseAdmin) {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(FILE_NAME);
    if (error) return [];
    const text = await data.text();
    return JSON.parse(text);
  } catch (err) {
    return [];
  }
}

async function saveManagedSections(supabaseAdmin, sections) {
  await ensureBucket(supabaseAdmin);
  const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(FILE_NAME, JSON.stringify(sections), {
    contentType: 'application/json',
    upsert: true
  });
  if (error) throw error;
}

module.exports = {
  getManagedSections,
  saveManagedSections
};
