const fs = require('fs');
const path = require('path');
const { pool } = require('../database/init');
const { UPLOAD_ROOT } = require('../middleware/upload');

// Returns the set of /uploads/... paths the database still references.
async function getReferencedPaths() {
  const paths = new Set();
  const queries = [
    'SELECT logo_url_light AS url FROM brand_kits WHERE logo_url_light IS NOT NULL',
    'SELECT logo_url_dark AS url FROM brand_kits WHERE logo_url_dark IS NOT NULL',
    'SELECT url FROM assets WHERE url IS NOT NULL',
    'SELECT image_url AS url FROM templates WHERE image_url IS NOT NULL',
    `SELECT (img->>'url') AS url
       FROM generations g, jsonb_array_elements(g.images) img
       WHERE jsonb_typeof(g.images) = 'array' AND img ? 'url'`
  ];
  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql);
      for (const r of rows) if (r.url && r.url.startsWith('/uploads/')) paths.add(r.url);
    } catch (err) {
      console.warn('[cleanup] query failed:', err.message);
    }
  }
  return paths;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function cleanupUploads({ dryRun = false } = {}) {
  const referenced = await getReferencedPaths();
  const files = walk(UPLOAD_ROOT);
  const toDelete = [];
  for (const abs of files) {
    const rel = '/uploads/' + path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');
    if (!referenced.has(rel)) toDelete.push(abs);
  }
  let bytesFreed = 0;
  for (const f of toDelete) {
    try {
      const stat = fs.statSync(f);
      bytesFreed += stat.size;
      if (!dryRun) fs.unlinkSync(f);
    } catch { /* ignore */ }
  }
  return {
    scanned: files.length,
    referenced: referenced.size,
    deleted: toDelete.length,
    bytesFreed,
    dryRun
  };
}

module.exports = { cleanupUploads, getReferencedPaths };

if (require.main === module) {
  cleanupUploads({ dryRun: process.argv.includes('--dry-run') })
    .then(r => { console.log('[cleanup]', r); process.exit(0); })
    .catch(err => { console.error('[cleanup] failed:', err); process.exit(1); });
}
