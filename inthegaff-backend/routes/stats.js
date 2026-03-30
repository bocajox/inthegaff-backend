const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Manchester postcode filter — only count M1-M60 postcodes + empty (unfiltered) ones
const MCR_FILTER = `(l.postcode ~ '^M\\d{1,2}\\s' OR l.postcode IS NULL OR l.postcode = '')`;

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const [listingsRes, agentsRes, areasRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM listings l WHERE l.is_active = true AND ${MCR_FILTER}`),
      pool.query(`SELECT COUNT(*) FROM agents WHERE status = 'active'`),
      pool.query(`SELECT COUNT(DISTINCT l.area) FROM listings l WHERE l.is_active = true AND ${MCR_FILTER}`),
    ]);
    res.json({
      liveListings: parseInt(listingsRes.rows[0].count),
      activeAgents: parseInt(agentsRes.rows[0].count),
      areasCovered: parseInt(areasRes.rows[0].count),
    });
  } catch (err) {
    console.error('GET /stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
