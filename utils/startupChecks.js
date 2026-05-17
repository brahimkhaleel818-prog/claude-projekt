// Warns (does not crash) about missing optional configuration so users see
// what features are degraded the moment they boot.
function reportEnvStatus() {
  const checks = [
    {
      key: 'GEMINI_API_KEY',
      label: 'Gemini',
      consequence: 'AI prompt composition / reverse / concepts / brand intel will return 503'
    },
    {
      key: 'FAL_KEY',
      label: 'FAL',
      consequence: 'image generation endpoints will persist failed rows and return 503'
    }
  ];
  const missing = checks.filter(c => !process.env[c.key]);
  if (!missing.length) {
    console.log('[env] all optional integrations configured');
    return;
  }
  console.warn('[env] degraded mode — missing optional keys:');
  for (const m of missing) console.warn(`  - ${m.label} (${m.key}): ${m.consequence}`);
}

module.exports = { reportEnvStatus };
