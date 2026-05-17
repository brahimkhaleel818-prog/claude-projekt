const express = require('express');
const { pool } = require('../database/init');

const router = express.Router();

const MAX_NAME_LENGTH = 200;

function normalizeName(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return null;
  return trimmed;
}

async function listClients() {
  const { rows } = await pool.query(
    'SELECT id, name, created_at, updated_at FROM clients ORDER BY id ASC'
  );
  return rows;
}

// GET /api/clients — list all clients plus the currently-active one.
router.get('/', async (req, res, next) => {
  try {
    const clients = await listClients();
    res.json({ clients, activeClientId: req.clientId });
  } catch (err) {
    next(err);
  }
});

// POST /api/clients — create a new client. Body: { name }.
router.post('/', async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    if (!name) {
      return res.status(400).json({
        error: 'invalid_name',
        message: `name is required and must be 1-${MAX_NAME_LENGTH} characters`
      });
    }
    const { rows } = await pool.query(
      'INSERT INTO clients (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
      [name]
    );
    const clients = await listClients();
    res.status(201).json({ client: rows[0], clients });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clients/:id — rename a client. Body: { name }.
router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    const name = normalizeName(req.body?.name);
    if (!name) {
      return res.status(400).json({
        error: 'invalid_name',
        message: `name is required and must be 1-${MAX_NAME_LENGTH} characters`
      });
    }
    const { rows } = await pool.query(
      'UPDATE clients SET name = $1 WHERE id = $2 RETURNING id, name, created_at, updated_at',
      [name, id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'client_not_found' });
    }
    const clients = await listClients();
    res.json({ client: rows[0], clients });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clients/:id — delete a client (cascades to all child rows).
// Guards: client must exist, and we must never end up with zero clients.
router.delete('/:id', async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM clients WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'client_not_found' });
    }

    const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS count FROM clients');
    if (countRows[0].count <= 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'last_client',
        message: 'Cannot delete the only remaining client. Create another first.'
      });
    }

    await client.query('DELETE FROM clients WHERE id = $1', [id]);
    await client.query('COMMIT');

    const clients = await listClients();
    const nextActiveId = req.clientId === id ? clients[0].id : req.clientId;
    res.json({ deletedId: id, clients, activeClientId: nextActiveId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
