const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not set. Configure it in .env to use AI features.');
    err.code = 'missing_gemini_key';
    throw err;
  }
  client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

function isAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Strip ```json ... ``` and leading prose around a JSON object/array.
function stripFences(text) {
  if (!text) return '';
  let t = String(text).trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1].trim();
  return t;
}

function extractJson(text) {
  const cleaned = stripFences(text);
  // Try as-is first.
  try { return JSON.parse(cleaned); } catch {}
  // Fall back to the longest {...} or [...] block.
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const candidates = [objMatch?.[0], arrMatch?.[0]].filter(Boolean);
  for (const c of candidates) {
    try { return JSON.parse(c); } catch {}
  }
  const err = new Error('Gemini response was not valid JSON');
  err.code = 'invalid_json';
  err.raw = cleaned;
  throw err;
}

async function generate({ prompt, system, json = false, model, images = [], temperature } = {}) {
  if (!prompt && !system) throw new Error('prompt is required');
  const client = getClient();
  const m = client.getGenerativeModel({
    model: model || MODEL,
    ...(system ? { systemInstruction: system } : {}),
    ...(json
      ? { generationConfig: { responseMimeType: 'application/json', temperature: temperature ?? 0.4 } }
      : { generationConfig: { temperature: temperature ?? 0.7 } })
  });

  const parts = [{ text: prompt }];
  for (const img of images) {
    if (img?.inlineData) parts.push({ inlineData: img.inlineData });
  }

  const started = Date.now();
  const result = await m.generateContent({ contents: [{ role: 'user', parts }] });
  const text = result?.response?.text?.() ?? '';
  const elapsedMs = Date.now() - started;

  if (json) {
    return { json: extractJson(text), raw: text, model: model || MODEL, elapsedMs };
  }
  return { text: stripFences(text), raw: text, model: model || MODEL, elapsedMs };
}

module.exports = { generate, isAvailable, MODEL };
