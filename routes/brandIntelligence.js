const express = require('express');
const { pool } = require('../database/init');
const gemini = require('../utils/gemini');

const router = express.Router();

const TEXT_FIELDS = ['persona', 'pain_point', 'angle', 'visual_direction', 'emotion', 'copy_hook', 'summary', 'source'];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM brand_intelligence WHERE client_id = $1 ORDER BY created_at DESC',
      [req.clientId]
    );
    res.json({ profiles: rows });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const fields = {};
    for (const k of TEXT_FIELDS) fields[k] = typeof body[k] === 'string' ? body[k].slice(0, 4000) : null;
    fields.source = fields.source || 'manual';
    const insights = body.insights && typeof body.insights === 'object' ? body.insights : {};
    const { rows } = await pool.query(
      `INSERT INTO brand_intelligence
        (client_id, source, summary, persona, pain_point, angle, visual_direction, emotion, copy_hook, insights)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING *`,
      [
        req.clientId, fields.source, fields.summary, fields.persona, fields.pain_point,
        fields.angle, fields.visual_direction, fields.emotion, fields.copy_hook,
        JSON.stringify(insights)
      ]
    );
    res.status(201).json({ profile: rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let i = 1;
    for (const k of TEXT_FIELDS) {
      if (req.body?.[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(req.body[k] == null ? null : String(req.body[k]).slice(0, 4000));
      }
    }
    if (req.body?.insights && typeof req.body.insights === 'object') {
      updates.push(`insights = $${i++}::jsonb`);
      values.push(JSON.stringify(req.body.insights));
    }
    if (!updates.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.clientId);
    const { rows } = await pool.query(
      `UPDATE brand_intelligence SET ${updates.join(', ')} WHERE id = $${i} AND client_id = $${i + 1} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ profile: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM brand_intelligence WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ deletedId: rows[0].id });
  } catch (err) { next(err); }
});

// POST /api/brand-intelligence/generate { research?, count? }
router.post('/generate', async (req, res, next) => {
  try {
    const research = typeof req.body?.research === 'string' ? req.body.research.slice(0, 8000) : '';
    const count = Math.max(1, Math.min(Number(req.body?.count) || 3, 8));

    const { rows: kitRows } = await pool.query('SELECT * FROM brand_kits WHERE client_id = $1', [req.clientId]);
    const kit = kitRows[0] || {};

    if (!gemini.isAvailable()) {
      return res.status(503).json({
        error: 'gemini_unavailable',
        message: 'GEMINI_API_KEY is not set on the server.'
      });
    }

    const system = `You are a brand strategist. Output strict JSON only. Never include markdown fences. Generate ${count} distinct profiles based on the brand context.`;
    const prompt = `Brand context:
- Name: ${kit.name || 'Unknown'}
- Tagline: ${kit.tagline || ''}
- Description: ${kit.description || ''}
${research ? `\nAdditional research:\n${research}` : ''}

Produce JSON of this exact shape:
{
  "profiles": [
    {
      "persona": "...",
      "pain_point": "...",
      "angle": "...",
      "visual_direction": "...",
      "emotion": "...",
      "copy_hook": "...",
      "summary": "..."
    }
  ]
}
Return exactly ${count} profiles, all distinct, all actionable for ad creative.`;

    let parsed;
    try {
      const out = await gemini.generate({ system, prompt, json: true });
      parsed = out.json;
    } catch (err) {
      return res.status(502).json({ error: 'generation_failed', message: err.message });
    }

    const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
    const inserted = [];
    for (const p of profiles) {
      const r = await pool.query(
        `INSERT INTO brand_intelligence
          (client_id, source, summary, persona, pain_point, angle, visual_direction, emotion, copy_hook, insights)
         VALUES ($1, 'ai', $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING *`,
        [
          req.clientId,
          p.summary || null, p.persona || null, p.pain_point || null,
          p.angle || null, p.visual_direction || null, p.emotion || null,
          p.copy_hook || null, JSON.stringify({ research_used: Boolean(research) })
        ]
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ profiles: inserted });
  } catch (err) { next(err); }
});

module.exports = router;
