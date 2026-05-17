const express = require('express');
const { pool } = require('../database/init');

const router = express.Router();

// GET /api/generations?status=&limit=
router.get('/', async (req, res, next) => {
  try {
    const params = [req.clientId];
    const where = ['client_id = $1'];
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }
    if (req.query.campaign_id) {
      params.push(Number(req.query.campaign_id));
      where.push(`campaign_id = $${params.length}`);
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 200);
    const { rows } = await pool.query(
      `SELECT * FROM generations WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    res.json({ generations: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM generations WHERE id = $1 AND client_id = $2',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ generation: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM generations WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.id, req.clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ deletedId: rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
