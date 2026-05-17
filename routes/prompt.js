const express = require('express');
const { pool } = require('../database/init');
const gemini = require('../utils/gemini');

const router = express.Router();

async function loadKit(clientId) {
  const { rows } = await pool.query('SELECT * FROM brand_kits WHERE client_id = $1', [clientId]);
  return rows[0] || null;
}
async function loadAssets(clientId, ids) {
  const cleaned = (ids || []).map(Number).filter(Number.isInteger);
  if (!cleaned.length) return [];
  const { rows } = await pool.query(
    'SELECT * FROM assets WHERE client_id = $1 AND id = ANY($2::int[])',
    [clientId, cleaned]
  );
  return rows;
}
async function loadIntel(clientId, ids) {
  if (!ids?.length) {
    const { rows } = await pool.query(
      'SELECT * FROM brand_intelligence WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5',
      [clientId]
    );
    return rows;
  }
  const cleaned = ids.map(Number).filter(Number.isInteger);
  const { rows } = await pool.query(
    'SELECT * FROM brand_intelligence WHERE client_id = $1 AND id = ANY($2::int[])',
    [clientId, cleaned]
  );
  return rows;
}

function deterministicCompose({ kit, reference, product, intel, goal }) {
  const lines = [];
  if (kit?.name) lines.push(`Static ad for ${kit.name}.`);
  if (goal) lines.push(`Campaign goal: ${goal}.`);
  if (product) lines.push(`Hero subject: the supplied product image (${product.category}).`);
  if (reference) lines.push(`Visual reference: match composition and lighting of the supplied reference (${reference.category}).`);
  if (intel?.length) {
    const p = intel[0];
    if (p.persona) lines.push(`Target audience: ${p.persona}.`);
    if (p.pain_point) lines.push(`Address the pain point: ${p.pain_point}.`);
    if (p.angle) lines.push(`Lead angle: ${p.angle}.`);
    if (p.visual_direction) lines.push(`Visual direction: ${p.visual_direction}.`);
    if (p.emotion) lines.push(`Emotion to evoke: ${p.emotion}.`);
    if (p.copy_hook) lines.push(`Copy hook to feature: "${p.copy_hook}".`);
  }
  const colors = kit?.colors || {};
  const palette = ['primary', 'secondary', 'accent'].map(k => colors[k]).filter(Boolean);
  if (palette.length) lines.push(`Color palette: ${palette.join(', ')}.`);
  const typo = kit?.typography || {};
  if (typo.primary) lines.push(`Primary typeface: ${typo.primary}.`);
  if (kit?.tagline) lines.push(`Suggested tagline: "${kit.tagline}".`);
  lines.push('Output: a single static ad image, high contrast, clear focal point, social-ready composition.');
  return lines.join(' ');
}

// POST /api/prompt/compose
router.post('/compose', async (req, res, next) => {
  try {
    const body = req.body || {};
    const goal = typeof body.goal === 'string' ? body.goal.slice(0, 1000) : '';
    const refId = body.reference_asset_id;
    const prodId = body.product_asset_id;
    const intelIds = Array.isArray(body.brand_intelligence_ids) ? body.brand_intelligence_ids : [];

    const [kit, refAndProd, intel] = await Promise.all([
      loadKit(req.clientId),
      loadAssets(req.clientId, [refId, prodId]),
      loadIntel(req.clientId, intelIds)
    ]);
    const reference = refAndProd.find(a => a.id === Number(refId)) || null;
    const product = refAndProd.find(a => a.id === Number(prodId)) || null;

    const deterministic = deterministicCompose({ kit, reference, product, intel, goal });

    if (!gemini.isAvailable()) {
      return res.json({
        prompt: deterministic,
        rationale: 'GEMINI_API_KEY not configured; returned deterministic prompt.',
        source: 'fallback',
        model: null
      });
    }

    const system = `You are a senior ad creative director. Output the executable image-generation prompt ONLY: plain prose, no markdown, no JSON, no headings, no fences, no preface. The first character of your reply must be the first character of the prompt.`;
    const prompt = `Compose a single executable image prompt that combines all of this context into one prose paragraph (no lists, no markdown):

BRAND KIT:
${kit ? JSON.stringify({
      name: kit.name, tagline: kit.tagline, description: kit.description,
      colors: kit.colors, typography: kit.typography
    }, null, 2) : 'none'}

REFERENCE IMAGE: ${reference ? `${reference.category} (${reference.original_name || reference.filename})` : 'none'}
PRODUCT IMAGE: ${product ? `${product.category} (${product.original_name || product.filename})` : 'none'}

BRAND INTELLIGENCE PROFILES:
${intel.length ? intel.slice(0, 3).map(p => `- persona: ${p.persona || '-'}; pain: ${p.pain_point || '-'}; angle: ${p.angle || '-'}; visual: ${p.visual_direction || '-'}; emotion: ${p.emotion || '-'}; copy hook: ${p.copy_hook || '-'}`).join('\n') : 'none'}

CAMPAIGN GOAL: ${goal || 'none'}

Constraints:
- One paragraph, ready to paste into an image generator
- Reference composition / lighting, never literal brand-name copying from competitor visuals
- Always end with a brief mention of layout intent (e.g. social square, clear focal point)`;

    try {
      const out = await gemini.generate({ system, prompt, temperature: 0.5 });
      const text = (out.text || '').trim();
      if (!text || text.length < 40) throw new Error('Gemini returned an unusable composition');
      return res.json({
        prompt: text,
        rationale: 'Composed by Gemini from brand kit, assets, intelligence, and goal.',
        source: 'ai',
        model: out.model,
        elapsed_ms: out.elapsedMs
      });
    } catch (err) {
      console.warn('[prompt/compose] Gemini failed, using fallback:', err.message);
      return res.json({
        prompt: deterministic,
        rationale: `Gemini call failed (${err.message}); returned deterministic prompt.`,
        source: 'fallback',
        model: null
      });
    }
  } catch (err) { next(err); }
});

// POST /api/prompt/reverse — analyze a winning image and emit a style prompt + copy skeleton + variants
// Body: { image_url, variant_count? }
router.post('/reverse', async (req, res, next) => {
  try {
    const imageUrl = typeof req.body?.image_url === 'string' ? req.body.image_url : '';
    if (!imageUrl) return res.status(400).json({ error: 'image_url required' });
    const variantCount = Math.max(1, Math.min(Number(req.body?.variant_count) || 3, 6));

    if (!gemini.isAvailable()) {
      return res.status(503).json({ error: 'gemini_unavailable', message: 'GEMINI_API_KEY is not set.' });
    }

    // Fetch the image inline so Gemini can see it.
    let inlineData;
    try {
      const fetchUrl = imageUrl.startsWith('/') ? `${req.protocol}://${req.get('host')}${imageUrl}` : imageUrl;
      const r = await fetch(fetchUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      inlineData = {
        data: buf.toString('base64'),
        mimeType: r.headers.get('content-type') || 'image/png'
      };
    } catch (err) {
      return res.status(400).json({ error: 'image_fetch_failed', message: err.message });
    }

    const system = `You are an ad reverse-engineering analyst. Output strict JSON only. NEVER copy competitor brand names, trademarks, or literal claims from the source image. Describe style, composition, and structure abstractly.`;
    const prompt = `Analyze the supplied winning ad image. Return JSON of this exact shape:
{
  "style_prompt": "one paragraph describing composition, lighting, color, typography style — no brand names",
  "copy_skeleton": {
    "headline": "structural pattern, not the literal headline",
    "subhead": "...",
    "cta": "...",
    "notes": "..."
  },
  "variants": [
    { "label": "variant name", "prompt": "executable image-generation prompt that reuses the style abstractly" }
  ]
}
Return exactly ${variantCount} variants. Variants must be distinct angles or formats while keeping the style language consistent. Do not include markdown or fences.`;

    let parsed;
    try {
      const out = await gemini.generate({
        system, prompt, json: true,
        images: [{ inlineData }],
        temperature: 0.6
      });
      parsed = out.json;
    } catch (err) {
      return res.status(502).json({ error: 'reverse_failed', message: err.message });
    }

    res.json({
      style_prompt: parsed?.style_prompt || '',
      copy_skeleton: parsed?.copy_skeleton || {},
      variants: Array.isArray(parsed?.variants) ? parsed.variants.slice(0, variantCount) : [],
      source_image: imageUrl,
      model: gemini.MODEL
    });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.deterministicCompose = deterministicCompose;
