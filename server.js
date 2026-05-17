require('dotenv').config();

const path = require('path');
const express = require('express');
const { initDatabase } = require('./database/init');
const { reportEnvStatus } = require('./utils/startupChecks');
const resolveClient = require('./middleware/resolveClient');
const clientsRouter = require('./routes/clients');
const brandKitsRouter = require('./routes/brandKits');
const assetsRouter = require('./routes/assets');
const templatesRouter = require('./routes/templates');
const generateRouter = require('./routes/generate');
const generationsRouter = require('./routes/generations');
const brandIntelRouter = require('./routes/brandIntelligence');
const promptRouter = require('./routes/prompt');
const campaignsRouter = require('./routes/campaigns');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Hardened static upload serving: deny anything that would resolve outside
// the uploads root or starts with a dot (hidden files).
app.use('/uploads', (req, res, next) => {
  if (req.path.includes('\0') || req.path.split('/').some(seg => seg.startsWith('.'))) {
    return res.status(400).send('invalid path');
  }
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  fallthrough: false,
  maxAge: '1h'
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'static-ads-generator',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Every /api route below this point has access to req.client / req.clientId.
app.use('/api', resolveClient);
app.use('/api/clients', clientsRouter);
app.use('/api/brand-kits', brandKitsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/generations', generationsRouter);
app.use('/api/brand-intelligence', brandIntelRouter);
app.use('/api/prompt', promptRouter);
app.use('/api/campaigns', campaignsRouter);
// Aliases so the spec's `/api/campaign/plan` and `/api/campaign/generate` also work.
app.use('/api/campaign', campaignsRouter);
app.use('/api/admin', adminRouter);

// JSON error handler for /api routes so the UI never gets HTML stack traces.
app.use('/api', (err, req, res, next) => {
  // Multer / Express body errors come pre-tagged with status.
  const status = err.status || err.statusCode || 500;
  const safeMessage = status >= 500
    ? 'Internal server error. Check the server logs.'
    : err.message;
  if (status >= 500) {
    console.error('[api] unhandled error:', err);
  } else {
    console.warn('[api]', status, err.message);
  }
  res.status(status).json({
    error: err.code || (status === 404 ? 'not_found' : 'request_failed'),
    message: safeMessage
  });
});

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('[startup] database initialization failed:', err.message);
    process.exit(1);
  }

  reportEnvStatus();

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  Static Ads Generator');
    console.log('========================================');
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  UI:      http://localhost:${PORT}/`);
    console.log(`  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  Status:  http://localhost:${PORT}/api/admin/status`);
    console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');
  });
}

start();
