const express = require('express');
const { cleanupUploads } = require('../utils/cleanupUploads');
const gemini = require('../utils/gemini');
const fal = require('../utils/fal');

const router = express.Router();

// GET /api/admin/status — surfaces what the server can/cannot do
router.get('/status', (req, res) => {
  res.json({
    integrations: {
      gemini: { available: gemini.isAvailable(), model: gemini.MODEL },
      fal: { available: fal.isAvailable(), model: fal.DEFAULT_MODEL }
    },
    uploads_path: '/uploads'
  });
});

// POST /api/admin/cleanup-uploads { dry_run? }
router.post('/cleanup-uploads', async (req, res, next) => {
  try {
    const result = await cleanupUploads({ dryRun: Boolean(req.body?.dry_run) });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
