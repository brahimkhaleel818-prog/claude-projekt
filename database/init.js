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

// Shared trigger function that keeps updated_at fresh on UPDATE.
const CREATE_TOUCH_FUNCTION = `
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
`;

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS brand_kits (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    colors JSONB NOT NULL DEFAULT '[]'::jsonb,
    fonts JSONB NOT NULL DEFAULT '[]'::jsonb,
    logo_url TEXT,
    tagline TEXT,
    voice JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT,
    aspect_ratio TEXT,
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    filename TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    width INTEGER,
    height INTEGER,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS generations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    brand_kit_id INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
    prompt TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    selected_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_tags (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, name)
  )`,

  `CREATE TABLE IF NOT EXISTS brand_intelligence (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source TEXT,
    summary TEXT,
    insights JSONB NOT NULL DEFAULT '{}'::jsonb,
    embeddings_ref TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
];

// Forward-compatible column additions. Safe to re-run on any version of the schema.
const ALTER_MIGRATIONS = [
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE templates ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE generations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE generations ADD COLUMN IF NOT EXISTS error TEXT`,
  `ALTER TABLE brand_intelligence ADD COLUMN IF NOT EXISTS embeddings_ref TEXT`
];

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_brand_kits_client_id ON brand_kits(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_templates_client_id ON templates(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assets_client_id ON assets(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_client_id ON generations(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_template_id ON generations(template_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_brand_kit_id ON generations(brand_kit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_tags_client_id ON campaign_tags(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_brand_intelligence_client_id ON brand_intelligence(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING GIN (tags)`,
  `CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN (tags)`
];

const TOUCH_TABLES = [
  'clients',
  'brand_kits',
  'templates',
  'assets',
  'generations',
  'campaign_tags',
  'brand_intelligence'
];

async function attachUpdatedAtTriggers(client) {
  for (const table of TOUCH_TABLES) {
    const trigger = `trg_${table}_set_updated_at`;
    await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
    await client.query(`
      CREATE TRIGGER ${trigger}
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
  }
}

async function initDatabase() {
  console.log('[db] connecting to PostgreSQL...');
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] connection ok');

    await client.query('BEGIN');

    await client.query(CREATE_TOUCH_FUNCTION);

    for (const sql of CREATE_TABLES) {
      await client.query(sql);
    }
    console.log(`[db] ensured ${CREATE_TABLES.length} tables`);

    for (const sql of ALTER_MIGRATIONS) {
      await client.query(sql);
    }
    console.log(`[db] applied ${ALTER_MIGRATIONS.length} column migrations`);

    for (const sql of CREATE_INDEXES) {
      await client.query(sql);
    }
    console.log(`[db] ensured ${CREATE_INDEXES.length} indexes`);

    await attachUpdatedAtTriggers(client);
    console.log(`[db] attached updated_at triggers to ${TOUCH_TABLES.length} tables`);

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

    await client.query('COMMIT');
    console.log('[db] schema initialization complete');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
