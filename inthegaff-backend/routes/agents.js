const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// GET /api/agents
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, website, areas, last_scraped, listings_found, status, error_msg
      FROM   agents
      ORDER  BY name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

module.exports = router;
