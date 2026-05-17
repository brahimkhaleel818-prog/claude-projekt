const { pool } = require('../database/init');

// Resolves the active client for the request and attaches it as req.client.
// Order of resolution:
//   1. X-Client-Id header (or ?clientId= query) if it points at a real client
//   2. Lowest-id client in the table (the default-client fallback)
// If neither resolves, every downstream route returns 503 so callers see a
// clear error instead of silently writing rows against a missing tenant.
function parseId(raw) {
  if (raw == null) return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function resolveClient(req, res, next) {
  try {
    const requestedId = parseId(req.header('x-client-id')) ?? parseId(req.query.clientId);

    let row;
    if (requestedId) {
      const { rows } = await pool.query(
        'SELECT id, name FROM clients WHERE id = $1',
        [requestedId]
      );
      row = rows[0];
    }

    if (!row) {
      const { rows } = await pool.query(
        'SELECT id, name FROM clients ORDER BY id ASC LIMIT 1'
      );
      row = rows[0];
    }

    if (!row) {
      return res.status(503).json({
        error: 'no_clients_available',
        message: 'No clients exist yet. Create one via POST /api/clients.'
      });
    }

    req.client = row;
    req.clientId = row.id;
    res.setHeader('X-Resolved-Client-Id', String(row.id));
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = resolveClient;
