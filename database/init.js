const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('========================================');
  console.error('  ERROR: DATABASE_URL is not set');
  console.error('========================================');
  console.error('  Add it to your .env file, e.g.:');
  console.error('    DATABASE_URL=postgres://user:pass@host:5432/dbname');
  console.error('  See .env.example for the full template.');
  console.error('========================================');
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error:', err.message);
});

const CREATE_CLIENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

async function initDatabase() {
  console.log('[db] connecting to PostgreSQL...');
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] connection ok');

    await client.query(CREATE_CLIENTS_TABLE);
    console.log('[db] clients table ready');

    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM clients');
    if (rows[0].count === 0) {
      const inserted = await client.query(
        'INSERT INTO clients (name) VALUES ($1) RETURNING id, name',
        ['Default Client']
      );
      console.log(`[db] seeded default client (id=${inserted.rows[0].id}, name="${inserted.rows[0].name}")`);
    } else {
      console.log(`[db] clients table already has ${rows[0].count} row(s); skipping seed`);
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
