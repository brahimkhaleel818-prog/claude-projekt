const { fal } = require('@fal-ai/client');

const DEFAULT_MODEL = process.env.FAL_MODEL || 'fal-ai/flux/dev';
const DEFAULT_TIMEOUT_MS = Number(process.env.FAL_TIMEOUT_MS || 90_000);

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!process.env.FAL_KEY) {
    const err = new Error('FAL_KEY is not set. Configure it in .env to use image generation.');
    err.code = 'missing_fal_key';
    throw err;
  }
  fal.config({ credentials: process.env.FAL_KEY });
  configured = true;
}

function isAvailable() {
  return Boolean(process.env.FAL_KEY);
}

// Aspect ratio → image_size hint that FAL Flux understands.
const ASPECT_TO_SIZE = {
  '1:1': 'square_hd',
  'square': 'square_hd',
  '4:5': 'portrait_4_3',
  '9:16': 'portrait_16_9',
  'portrait': 'portrait_16_9',
  '16:9': 'landscape_16_9',
  'landscape': 'landscape_16_9'
};

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'timeout' })), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// Normalize the raw FAL response to a stable shape:
//   { images: [{ url, width, height, content_type }], seed, model, elapsedMs, raw }
function normalize(raw, model, elapsedMs) {
  const data = raw?.data || raw || {};
  const images = Array.isArray(data.images) ? data.images : [];
  return {
    images: images.map(img => ({
      url: img.url,
      width: img.width,
      height: img.height,
      content_type: img.content_type
    })),
    seed: data.seed,
    prompt: data.prompt,
    model,
    elapsedMs,
    raw
  };
}

async function generateImage({
  prompt,
  model,
  aspectRatio = '1:1',
  numImages = 1,
  imageUrl,
  extraInput = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (!prompt) throw new Error('prompt is required');
  ensureConfigured();
  const selected = model || DEFAULT_MODEL;

  const input = {
    prompt,
    num_images: Math.max(1, Math.min(Number(numImages) || 1, 4)),
    image_size: ASPECT_TO_SIZE[aspectRatio] || aspectRatio,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...extraInput
  };

  const started = Date.now();
  try {
    const result = await withTimeout(fal.subscribe(selected, { input, logs: false }), timeoutMs, 'FAL request');
    return normalize(result, selected, Date.now() - started);
  } catch (err) {
    const wrapped = new Error(err?.message || 'FAL request failed');
    wrapped.code = err?.code || 'fal_error';
    wrapped.cause = err;
    wrapped.elapsedMs = Date.now() - started;
    throw wrapped;
  }
}

module.exports = { generateImage, isAvailable, DEFAULT_MODEL };
