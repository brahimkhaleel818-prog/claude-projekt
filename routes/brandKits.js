const fs = require('fs');
const express = require('express');
const { pool } = require('../database/init');
const { logoUpload, publicPathFor } = require('../middleware/upload');

const router = express.Router();

const DEFAULT_KIT = {
  name: '',
  description: '',
  tagline: '',
  colors: { primary: '#6366f1', secondary: '#1e293b', accent: '#f59e0b' },
  typography: { primary: '', secondary: '' },
  voice: {},
  metadata: {}
};

async function getOrCreateKit(clientId) {
  const { rows } = await pool.query(
    'SELECT * FROM brand_kits WHERE client_id = $1',
    [clientId]
  );
  if (rows[0]) return rows[0];
  const ins = await pool.query(
    `INSERT INTO brand_kits (client_id, name, description, tagline, colors, typography, voice, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      clientId,
      DEFAULT_KIT.name,
      DEFAULT_KIT.description,
      DEFAULT_KIT.tagline,
      JSON.stringify(DEFAULT_KIT.colors),
      JSON.stringify(DEFAULT_KIT.typography),
      JSON.stringify(DEFAULT_KIT.voice),
      JSON.stringify(DEFAULT_KIT.metadata)
    ]
  );
  return ins.rows[0];
}

router.get('/', async (req, res, next) => {
  try {
    const kit = await getOrCreateKit(req.clientId);
    res.json({ kit });
  } catch (err) {
    next(err);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const kit = await getOrCreateKit(req.clientId);
    const allowed = {
      name: typeof req.body?.name === 'string' ? req.body.name.slice(0, 200) : undefined,
      description: typeof req.body?.description === 'string' ? req.body.description.slice(0, 5000) : undefined,
      tagline: typeof req.body?.tagline === 'string' ? req.body.tagline.slice(0, 500) : undefined,
      colors: req.body?.colors && typeof req.body.colors === 'object' ? req.body.colors : undefined,
      typography: req.body?.typography && typeof req.body.typography === 'object' ? req.body.typography : undefined,
      voice: req.body?.voice && typeof req.body.voice === 'object' ? req.body.voice : undefined,
      logo_url_light: typeof req.body?.logo_url_light === 'string' ? req.body.logo_url_light : undefined,
      logo_url_dark: typeof req.body?.logo_url_dark === 'string' ? req.body.logo_url_dark : undefined
    };

    const updates = [];
    const values = [];
    let i = 1;
    for (const [key, val] of Object.entries(allowed)) {
      if (val === undefined) continue;
      if (['colors', 'typography', 'voice'].includes(key)) {
        updates.push(`${key} = $${i++}::jsonb`);
        values.push(JSON.stringify(val));
      } else {
        updates.push(`${key} = $${i++}`);
        values.push(val);
      }
    }
    if (updates.length === 0) {
      return res.json({ kit });
    }
    values.push(kit.id);
    const { rows } = await pool.query(
      `UPDATE brand_kits SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json({ kit: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/brand-kits/logo?variant=light|dark
function handleLogoUpload(req, res, next) {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'upload_failed', message: err.message });
    next();
  });
}

router.post('/logo', handleLogoUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const variant = req.query.variant === 'dark' ? 'dark' : 'light';
    const column = variant === 'dark' ? 'logo_url_dark' : 'logo_url_light';
    const publicPath = publicPathFor(req.file);

    const kit = await getOrCreateKit(req.clientId);

    // best-effort cleanup of any prior file for this variant
    const prior = kit[column];
    if (prior && prior.startsWith('/uploads/')) {
      const abs = require('path').join(__dirname, '..', prior.replace(/^\/+/, ''));
      fs.promises.unlink(abs).catch(() => {});
    }

    const { rows } = await pool.query(
      `UPDATE brand_kits SET ${column} = $1 WHERE id = $2 RETURNING *`,
      [publicPath, kit.id]
    );
    res.json({ kit: rows[0], variant, url: publicPath });
  } catch (err) {
    next(err);
  }
});

router.delete('/logo', async (req, res, next) => {
  try {
    const variant = req.query.variant === 'dark' ? 'dark' : 'light';
    const column = variant === 'dark' ? 'logo_url_dark' : 'logo_url_light';
    const kit = await getOrCreateKit(req.clientId);
    const prior = kit[column];
    if (prior && prior.startsWith('/uploads/')) {
      const abs = require('path').join(__dirname, '..', prior.replace(/^\/+/, ''));
      fs.promises.unlink(abs).catch(() => {});
    }
    const { rows } = await pool.query(
      `UPDATE brand_kits SET ${column} = NULL WHERE id = $1 RETURNING *`,
      [kit.id]
    );
    res.json({ kit: rows[0], variant });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
