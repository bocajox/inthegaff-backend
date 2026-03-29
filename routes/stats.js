const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const [listingsRes, agentsRes, areasRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM listings WHERE is_active = true`),
      pool.query(`SELECT COUNT(*) FROM agents WHERE status = 'active'`),
      pool.query(`SELECT COUNT(DISTINCT area) FROM listings WHERE is_active = true`),
    ]);
    res.json({
      liveListings:  parseInt(listingsRes.rows[0].count),
      activeAgents:  parseInt(agentsRes.rows[0].count),
      areasCovered:  parseInt(areasRes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
