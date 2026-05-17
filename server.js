require('dotenv').config();

const path = require('path');
const express = require('express');
const { initDatabase } = require('./database/init');
const resolveClient = require('./middleware/resolveClient');
const clientsRouter = require('./routes/clients');
const brandKitsRouter = require('./routes/brandKits');
const assetsRouter = require('./routes/assets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// JSON error handler for /api routes so the UI never gets HTML stack traces.
app.use('/api', (err, req, res, next) => {
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('[startup] database initialization failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  Static Ads Generator');
    console.log('========================================');
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  UI:      http://localhost:${PORT}/`);
    console.log(`  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  Clients: http://localhost:${PORT}/api/clients`);
    console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');
  });
}

start();
