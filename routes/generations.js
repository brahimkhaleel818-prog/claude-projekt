const express = require('express');
const { pool } = require('../database/init');
const { downloadImage } = require('../utils/downloadImage');

const router = express.Router();

// GET /api/generations?status=&limit=
router.get('/', async (req, res, next) => {
  try {
    const params = [req.clientId];
    const where = ['client_id = $1'];
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }
    if (req.query.campaign_id) {
      params.push(Number(req.query.campaign_id));
      where.push(`campaign_id = $${params.length}`);
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 200);
    const { rows } = await pool.query(
      `SELECT * FROM generations WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    res.json({ generations: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM generations WHERE id = $1 AND client_id = $2',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ generation: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM generations WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ deletedId: rows[0].id });
  } catch (err) { next(err); }
});

// POST /api/generations/:id/save-as-template
// Body: { name?, category?, tags?, image_index? }
router.post('/:id/save-as-template', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM generations WHERE id = $1 AND client_id = $2',
      [req.params.id, req.clientId]
    );
    const gen = rows[0];
    if (!gen) return res.status(404).json({ error: 'not_found' });
    if (gen.status !== 'succeeded') return res.status(400).json({ error: 'not_succeeded' });

    const images = Array.isArray(gen.images) ? gen.images : [];
    const idx = Number.isInteger(Number(req.body?.image_index)) ? Number(req.body.image_index) : 0;
    const image = images[idx];
    if (!image?.url) return res.status(400).json({ error: 'no_image_at_index' });

    const saved = await downloadImage({ url: image.url, clientId: req.clientId, subdir: 'templates' });

    const name = (req.body?.name || `Template from gen #${gen.id}`).slice(0, 200);
    const category = req.body?.category ? String(req.body.category).slice(0, 100) : 'winner';
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 50) : [];

    const ins = await pool.query(
      `INSERT INTO templates (client_id, name, category, tags, image_url, thumbnail_url, source_type, source_generation_id, format, metadata)
       VALUES ($1, $2, $3, $4::jsonb, $5, $5, 'generated', $6, $7, $8::jsonb)
       RETURNING *`,
      [
        req.clientId,
        name,
        category,
        JSON.stringify(tags),
        saved.publicPath,
        gen.id,
        gen.metadata?.aspect_ratio || null,
        JSON.stringify({
          source_prompt: gen.prompt,
          source_image_index: idx,
          source_generation_id: gen.id
        })
      ]
    );

    res.status(201).json({ template: ins.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
