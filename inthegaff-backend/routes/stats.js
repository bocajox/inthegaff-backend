const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Known non-Manchester cities that slip through when postcode is empty
const BAD_CITIES = `'london','birmingham','liverpool','leeds','sheffield','barnsley','maidenhead','penzance','surbiton','chesterfield','solihull','hoyland','bristol','nottingham','coventry','reading','swindon','bolton','wigan','warrington','stoke','derby','leicester','oxford','cambridge','southampton','portsmouth','plymouth','exeter','bath','york','hull','sunderland','newcastle','gateshead','brighton','bournemouth','cardiff','swansea','edinburgh','glasgow'`;

// Manchester postcode filter — M1-M60 postcodes, OR empty postcode but street not in a known non-Manchester city
const MCR_FILTER = `(
  l.postcode ~ '^M\\d{1,2}\\s'
  OR (
    (l.postcode IS NULL OR l.postcode = '')
    AND NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY[${BAD_CITIES}]) AS city
      WHERE LOWER(l.street) LIKE '%' || city || '%'
    )
  )
)`;

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
