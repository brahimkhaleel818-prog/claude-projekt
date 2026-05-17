const fs = require('fs');
const path = require('path');
const express = require('express');
const { pool } = require('../database/init');
const { assetUpload, publicPathFor, UPLOAD_ROOT } = require('../middleware/upload');

const router = express.Router();

const VALID_CATEGORIES = ['product', 'packaging', 'lifestyle', 'logo', 'other'];

function normalizeCategory(raw) {
  if (typeof raw !== 'string') return 'other';
  const v = raw.toLowerCase().trim();
  return VALID_CATEGORIES.includes(v) ? v : 'other';
}

function handleAssetUpload(req, res, next) {
  assetUpload.array('files', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'upload_failed', message: err.message });
    next();
  });
}

// GET /api/assets?category=&q=
router.get('/', async (req, res, next) => {
  try {
    const params = [req.clientId];
    const where = ['client_id = $1'];
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) {
      params.push(req.query.category);
      where.push(`category = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      where.push(`(LOWER(COALESCE(original_name, '')) LIKE $${params.length} OR LOWER(COALESCE(filename, '')) LIKE $${params.length})`);
    }
    const { rows } = await pool.query(
      `SELECT * FROM assets WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    res.json({ assets: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM assets WHERE id = $1 AND client_id = $2',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ asset: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/assets — multi-file
router.post('/', handleAssetUpload, async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'no_files' });
    const category = normalizeCategory(req.body?.category);
    const rows = [];
    for (const f of req.files) {
      const publicPath = publicPathFor(f);
      const ins = await pool.query(
        `INSERT INTO assets (client_id, type, url, filename, original_name, mime_type, size_bytes, category)
         VALUES ($1, 'image', $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.clientId, publicPath, path.basename(f.path), f.originalname, f.mimetype, f.size, category]
      );
      rows.push(ins.rows[0]);
    }
    res.status(201).json({ assets: rows });
  } catch (err) { next(err); }
});

// PATCH /api/assets/:id — edit category / tags / metadata
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let i = 1;
    if (req.body?.category !== undefined) {
      updates.push(`category = $${i++}`); values.push(normalizeCategory(req.body.category));
    }
    if (Array.isArray(req.body?.tags)) {
      updates.push(`tags = $${i++}::jsonb`); values.push(JSON.stringify(req.body.tags));
    }
    if (req.body?.metadata && typeof req.body.metadata === 'object') {
      updates.push(`metadata = $${i++}::jsonb`); values.push(JSON.stringify(req.body.metadata));
    }
    if (req.body?.original_name !== undefined) {
      updates.push(`original_name = $${i++}`); values.push(String(req.body.original_name).slice(0, 500));
    }
    if (!updates.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.clientId);
    const { rows } = await pool.query(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = $${i} AND client_id = $${i + 1} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ asset: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/assets/bulk — { ids: [...], category? }
router.post('/bulk', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (!ids.length) return res.status(400).json({ error: 'no_ids' });
    const category = normalizeCategory(req.body?.category);
    const { rows } = await pool.query(
      `UPDATE assets SET category = $1 WHERE client_id = $2 AND id = ANY($3::int[]) RETURNING *`,
      [category, req.clientId, ids]
    );
    res.json({ assets: rows });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM assets WHERE id = $1 AND client_id = $2 RETURNING url',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    // best-effort file cleanup
    if (rows[0].url?.startsWith('/uploads/')) {
      const abs = path.join(UPLOAD_ROOT, '..', rows[0].url.replace(/^\/+/, ''));
      // Make sure resolved path stays under uploads root
      const resolved = path.resolve(abs);
      if (resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
        fs.promises.unlink(resolved).catch(() => {});
      }
    }
    res.json({ deletedId: Number(req.params.id) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.VALID_CATEGORIES = VALID_CATEGORIES;
