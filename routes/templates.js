const fs = require('fs');
const path = require('path');
const express = require('express');
const { pool } = require('../database/init');
const { templateUpload, publicPathFor, UPLOAD_ROOT } = require('../middleware/upload');

const router = express.Router();

function handleUpload(req, res, next) {
  templateUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'upload_failed', message: err.message });
    next();
  });
}

// GET /api/templates?category=&favorite=true&q=
router.get('/', async (req, res, next) => {
  try {
    const params = [req.clientId];
    const where = ['client_id = $1'];
    if (req.query.category) {
      params.push(req.query.category);
      where.push(`category = $${params.length}`);
    }
    if (req.query.favorite === 'true') {
      where.push('favorite = TRUE');
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      where.push(`(LOWER(COALESCE(name,'')) LIKE $${params.length} OR LOWER(COALESCE(category,'')) LIKE $${params.length})`);
    }
    const { rows } = await pool.query(
      `SELECT * FROM templates WHERE ${where.join(' AND ')} ORDER BY favorite DESC, created_at DESC`,
      params
    );
    res.json({ templates: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM templates WHERE id = $1 AND client_id = $2',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ template: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', handleUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const name = (req.body?.name || req.file.originalname || 'Untitled').slice(0, 200);
    const category = req.body?.category ? String(req.body.category).slice(0, 100) : null;
    const tags = parseTags(req.body?.tags);
    const url = publicPathFor(req.file);
    const { rows } = await pool.query(
      `INSERT INTO templates (client_id, name, category, tags, image_url, thumbnail_url, source_type, format)
       VALUES ($1, $2, $3, $4::jsonb, $5, $5, 'uploaded', $6)
       RETURNING *`,
      [req.clientId, name, category, JSON.stringify(tags), url, req.body?.format || null]
    );
    res.status(201).json({ template: rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let i = 1;
    if (req.body?.name !== undefined) { updates.push(`name = $${i++}`); values.push(String(req.body.name).slice(0, 200)); }
    if (req.body?.category !== undefined) { updates.push(`category = $${i++}`); values.push(req.body.category ? String(req.body.category).slice(0, 100) : null); }
    if (Array.isArray(req.body?.tags)) { updates.push(`tags = $${i++}::jsonb`); values.push(JSON.stringify(parseTags(req.body.tags))); }
    if (typeof req.body?.favorite === 'boolean') { updates.push(`favorite = $${i++}`); values.push(req.body.favorite); }
    if (req.body?.metadata && typeof req.body.metadata === 'object') {
      updates.push(`metadata = $${i++}::jsonb`); values.push(JSON.stringify(req.body.metadata));
    }
    if (!updates.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.clientId);
    const { rows } = await pool.query(
      `UPDATE templates SET ${updates.join(', ')} WHERE id = $${i} AND client_id = $${i + 1} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ template: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND client_id = $2 RETURNING image_url',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    if (rows[0].image_url?.startsWith('/uploads/')) {
      const abs = path.resolve(path.join(UPLOAD_ROOT, '..', rows[0].image_url.replace(/^\/+/, '')));
      if (abs.startsWith(path.resolve(UPLOAD_ROOT))) {
        fs.promises.unlink(abs).catch(() => {});
      }
    }
    res.json({ deletedId: Number(req.params.id) });
  } catch (err) { next(err); }
});

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean).slice(0, 50);
  if (typeof raw === 'string') return raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 50);
  return [];
}

module.exports = router;
