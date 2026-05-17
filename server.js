require('dotenv').config();

const path = require('path');
const express = require('express');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
    console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');
  });
}

start();
