const express = require('express');
const { pool } = require('../database/init');
const fal = require('../utils/fal');
const { deterministicCompose } = require('./prompt');

const router = express.Router();

const VALID_ASPECTS = ['1:1', '4:5', '9:16', '16:9'];

async function loadCampaign(id, clientId) {
  const { rows } = await pool.query(
    'SELECT * FROM campaigns WHERE id = $1 AND client_id = $2', [id, clientId]
  );
  return rows[0] || null;
}

// GET /api/campaigns
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM campaigns WHERE client_id = $1 ORDER BY created_at DESC',
      [req.clientId]
    );
    res.json({ campaigns: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await loadCampaign(req.params.id, req.clientId);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const { rows: gens } = await pool.query(
      'SELECT * FROM generations WHERE campaign_id = $1 ORDER BY created_at ASC',
      [campaign.id]
    );
    res.json({ campaign, generations: gens });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM campaigns WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ deletedId: rows[0].id });
  } catch (err) { next(err); }
});

// POST /api/campaign/plan
// Body: { name, goal, intelligence_ids[], reference_asset_id?, product_asset_id?, ads_per_profile?, aspect_ratio? }
router.post('/plan', async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = (body.name || `Campaign ${new Date().toISOString().slice(0, 10)}`).slice(0, 200);
    const goal = typeof body.goal === 'string' ? body.goal.slice(0, 2000) : '';
    const intelIds = Array.isArray(body.intelligence_ids) ? body.intelligence_ids.map(Number).filter(Number.isInteger) : [];
    if (!intelIds.length) return res.status(400).json({ error: 'no_profiles', message: 'Select at least one intelligence profile.' });
    const adsPerProfile = Math.max(1, Math.min(Number(body.ads_per_profile) || 1, 4));
    const aspectRatio = VALID_ASPECTS.includes(body.aspect_ratio) ? body.aspect_ratio : '1:1';
    const referenceAssetId = body.reference_asset_id ? Number(body.reference_asset_id) : null;
    const productAssetId = body.product_asset_id ? Number(body.product_asset_id) : null;

    const { rows: intelRows } = await pool.query(
      'SELECT * FROM brand_intelligence WHERE client_id = $1 AND id = ANY($2::int[])',
      [req.clientId, intelIds]
    );
    if (!intelRows.length) return res.status(400).json({ error: 'no_valid_profiles' });

    const { rows: kitRows } = await pool.query('SELECT * FROM brand_kits WHERE client_id = $1', [req.clientId]);
    const kit = kitRows[0] || null;

    let reference = null, product = null;
    if (referenceAssetId || productAssetId) {
      const { rows } = await pool.query(
        'SELECT * FROM assets WHERE client_id = $1 AND id = ANY($2::int[])',
        [req.clientId, [referenceAssetId, productAssetId].filter(Boolean)]
      );
      reference = rows.find(a => a.id === referenceAssetId) || null;
      product = rows.find(a => a.id === productAssetId) || null;
    }

    const plan = [];
    for (const profile of intelRows) {
      for (let i = 0; i < adsPerProfile; i++) {
        plan.push({
          profile_id: profile.id,
          persona: profile.persona,
          angle: profile.angle,
          variant_index: i,
          aspect_ratio: aspectRatio,
          prompt: deterministicCompose({
            kit, reference, product, intel: [profile], goal
          })
        });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO campaigns (client_id, name, goal, plan, status, metadata)
       VALUES ($1, $2, $3, $4::jsonb, 'planned', $5::jsonb)
       RETURNING *`,
      [
        req.clientId, name, goal, JSON.stringify(plan),
        JSON.stringify({
          intelligence_ids: intelIds,
          reference_asset_id: referenceAssetId,
          product_asset_id: productAssetId,
          ads_per_profile: adsPerProfile,
          aspect_ratio: aspectRatio
        })
      ]
    );
    res.status(201).json({ campaign: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/campaign/:id/generate — execute the plan
router.post('/:id/generate', async (req, res, next) => {
  try {
    const campaign = await loadCampaign(req.params.id, req.clientId);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const plan = Array.isArray(campaign.plan) ? campaign.plan : [];
    if (!plan.length) return res.status(400).json({ error: 'empty_plan' });

    await pool.query(`UPDATE campaigns SET status='running' WHERE id=$1`, [campaign.id]);

    const results = [];
    for (const item of plan) {
      const pending = await pool.query(
        `INSERT INTO generations
          (client_id, campaign_id, brand_kit_id, prompt, status, selected_assets, images, metadata, concept, avatar)
         VALUES ($1, $2, $3, $4, 'pending', $5::jsonb, '[]'::jsonb, $6::jsonb, $7, $8)
         RETURNING *`,
        [
          req.clientId, campaign.id, null, item.prompt,
          JSON.stringify({
            reference_asset_id: campaign.metadata?.reference_asset_id || null,
            product_asset_id: campaign.metadata?.product_asset_id || null
          }),
          JSON.stringify({
            aspect_ratio: item.aspect_ratio,
            profile_id: item.profile_id,
            variant_index: item.variant_index,
            campaign_id: campaign.id
          }),
          item.angle || null,
          item.persona || null
        ]
      );
      const generationId = pending.rows[0].id;

      if (!fal.isAvailable()) {
        await pool.query(`UPDATE generations SET status='failed', error=$1 WHERE id=$2`,
          ['FAL_KEY not configured', generationId]);
        results.push({ generation_id: generationId, status: 'failed', error: 'fal_unavailable' });
        continue;
      }

      try {
        const out = await fal.generateImage({
          prompt: item.prompt, aspectRatio: item.aspect_ratio, numImages: 1
        });
        const images = out.images.map(img => ({
          url: img.url, width: img.width, height: img.height,
          content_type: img.content_type, status: 'ok'
        }));
        await pool.query(
          `UPDATE generations SET status='succeeded', images=$1::jsonb,
            metadata = metadata || $2::jsonb, error=NULL WHERE id=$3`,
          [JSON.stringify(images),
           JSON.stringify({ seed: out.seed, model: out.model, elapsed_ms: out.elapsedMs }),
           generationId]
        );
        results.push({ generation_id: generationId, status: 'succeeded', images });
      } catch (err) {
        await pool.query(`UPDATE generations SET status='failed', error=$1 WHERE id=$2`,
          [err.message, generationId]);
        results.push({ generation_id: generationId, status: 'failed', error: err.message });
      }
    }

    const allOk = results.every(r => r.status === 'succeeded');
    const anyOk = results.some(r => r.status === 'succeeded');
    const status = allOk ? 'completed' : anyOk ? 'partial' : 'failed';
    const { rows } = await pool.query(
      `UPDATE campaigns SET status=$1, metadata = metadata || $2::jsonb WHERE id=$3 RETURNING *`,
      [status, JSON.stringify({ last_run: new Date().toISOString(), total: results.length }), campaign.id]
    );
    res.json({ campaign: rows[0], results });
  } catch (err) { next(err); }
});

module.exports = router;
