const express = require('express');
const { pool } = require('../database/init');
const fal = require('../utils/fal');

const router = express.Router();

const VALID_ASPECTS = ['1:1', '4:5', '9:16', '16:9'];

async function loadClientContext(clientId, body) {
  const ids = {
    reference: Number(body.reference_asset_id) || null,
    product: Number(body.product_asset_id) || null
  };
  const assetIds = [ids.reference, ids.product].filter(Boolean);
  let assets = [];
  if (assetIds.length) {
    const { rows } = await pool.query(
      'SELECT * FROM assets WHERE client_id = $1 AND id = ANY($2::int[])',
      [clientId, assetIds]
    );
    assets = rows;
  }
  let kit = null;
  if (body.apply_brand_kit) {
    const { rows } = await pool.query('SELECT * FROM brand_kits WHERE client_id = $1', [clientId]);
    kit = rows[0] || null;
  }
  const reference = assets.find(a => a.id === ids.reference) || null;
  const product = assets.find(a => a.id === ids.product) || null;
  return { reference, product, kit };
}

function buildFinalPrompt({ basePrompt, kit }) {
  if (!kit) return basePrompt;
  const constraints = [];
  if (kit.name) constraints.push(`Brand: ${kit.name}`);
  if (kit.tagline) constraints.push(`Tagline: ${kit.tagline}`);
  if (kit.description) constraints.push(`Brand voice: ${kit.description}`);
  const colors = kit.colors || {};
  const palette = ['primary', 'secondary', 'accent']
    .map(k => colors[k]).filter(Boolean).join(', ');
  if (palette) constraints.push(`Color palette: ${palette}`);
  const typo = kit.typography || {};
  if (typo.primary) constraints.push(`Primary typeface: ${typo.primary}`);
  if (!constraints.length) return basePrompt;
  return `${basePrompt}\n\n--- BRAND CONSTRAINTS ---\n${constraints.join('\n')}`;
}

function publicUrl(req, relative) {
  if (!relative) return null;
  if (relative.startsWith('http')) return relative;
  return `${req.protocol}://${req.get('host')}${relative}`;
}

// POST /api/generate
router.post('/', async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ error: 'invalid_prompt', message: 'prompt is required' });

    const aspectRatio = VALID_ASPECTS.includes(req.body?.aspect_ratio) ? req.body.aspect_ratio : '1:1';
    const numImages = Math.max(1, Math.min(Number(req.body?.num_images) || 1, 4));
    const templateId = Number(req.body?.template_id) || null;

    const ctx = await loadClientContext(req.clientId, req.body);
    const finalPrompt = buildFinalPrompt({ basePrompt: prompt, kit: ctx.kit });

    // Persist a pending generation row up front so the UI can show it immediately.
    const pending = await pool.query(
      `INSERT INTO generations
        (client_id, template_id, brand_kit_id, prompt, status, selected_assets, images, metadata)
       VALUES ($1, $2, $3, $4, 'pending', $5::jsonb, '[]'::jsonb, $6::jsonb)
       RETURNING *`,
      [
        req.clientId,
        templateId,
        ctx.kit?.id || null,
        finalPrompt,
        JSON.stringify({
          reference_asset_id: ctx.reference?.id || null,
          product_asset_id: ctx.product?.id || null
        }),
        JSON.stringify({
          base_prompt: prompt,
          aspect_ratio: aspectRatio,
          num_images: numImages,
          apply_brand_kit: Boolean(req.body?.apply_brand_kit)
        })
      ]
    );
    const generationId = pending.rows[0].id;

    if (!fal.isAvailable()) {
      await pool.query(
        `UPDATE generations SET status='failed', error=$1 WHERE id=$2`,
        ['FAL_KEY is not configured. Set it in .env to enable image generation.', generationId]
      );
      return res.status(503).json({
        error: 'fal_unavailable',
        message: 'FAL_KEY is not set on the server.',
        generation: { id: generationId, status: 'failed' }
      });
    }

    let result;
    try {
      result = await fal.generateImage({
        prompt: finalPrompt,
        aspectRatio,
        numImages,
        imageUrl: publicUrl(req, ctx.reference?.url || ctx.product?.url || null)
      });
    } catch (err) {
      await pool.query(
        `UPDATE generations SET status='failed', error=$1 WHERE id=$2`,
        [err.message, generationId]
      );
      return res.status(502).json({
        error: 'generation_failed',
        message: err.message,
        generation: { id: generationId, status: 'failed' }
      });
    }

    const images = result.images.map(img => ({
      url: img.url,
      width: img.width,
      height: img.height,
      content_type: img.content_type,
      status: 'ok'
    }));

    const { rows } = await pool.query(
      `UPDATE generations
       SET status = $1, images = $2::jsonb, metadata = metadata || $3::jsonb, error = NULL
       WHERE id = $4 RETURNING *`,
      [
        'succeeded',
        JSON.stringify(images),
        JSON.stringify({ seed: result.seed, model: result.model, elapsed_ms: result.elapsedMs }),
        generationId
      ]
    );

    res.json({ generation: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
