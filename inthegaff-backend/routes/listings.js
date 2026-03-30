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

// GET /api/listings
router.get('/', async (req, res) => {
  try {
    const {
      area, beds, type, minPrice, maxPrice,
      furnished, parking, pets, garden, balcony,
      sort = 'newest', limit = 50, offset = 0
    } = req.query;

    // Only show active Manchester listings with a valid source URL
    const conditions = [
      'l.is_active = true',
      "l.listing_url IS NOT NULL",
      "l.listing_url != ''",
      MCR_FILTER
    ];
    const values = [];
    let idx = 1;

    if (area) {
      conditions.push(`(LOWER(l.area) LIKE $${idx} OR LOWER(l.postcode) LIKE $${idx} OR LOWER(l.street) LIKE $${idx})`);
      values.push(`%${area.toLowerCase()}%`);
      idx++;
    }
    if (beds !== undefined && beds !== '') {
      if (beds === '0') {
        conditions.push(`l.beds = $${idx}`); values.push(0); idx++;
      } else if (beds === '4') {
        conditions.push(`l.beds >= $${idx}`); values.push(4); idx++;
      } else {
        conditions.push(`l.beds = $${idx}`); values.push(parseInt(beds)); idx++;
      }
    }
    if (type && type !== 'all') {
      conditions.push(`l.type = $${idx}`); values.push(type); idx++;
    }
    if (minPrice) { conditions.push(`l.price >= $${idx}`); values.push(parseInt(minPrice)); idx++; }
    if (maxPrice) { conditions.push(`l.price <= $${idx}`); values.push(parseInt(maxPrice)); idx++; }
    if (furnished === 'true') { conditions.push(`l.furnished = true`); }
    if (parking === 'true')   { conditions.push(`l.parking = true`); }
    if (pets === 'true')      { conditions.push(`l.pets = true`); }
    if (garden === 'true')    { conditions.push(`l.garden = true`); }
    if (balcony === 'true')   { conditions.push(`l.balcony = true`); }

    const orderMap = {
      newest: 'l.first_seen DESC',
      low: 'l.price ASC',
      high: 'l.price DESC',
    };
    const orderBy = orderMap[sort] || orderMap.newest;

    const where = conditions.join(' AND ');
    values.push(parseInt(limit), parseInt(offset));

    const { rows } = await pool.query(`
      SELECT l.*, a.name AS agent_name, a.website AS agent_website
      FROM listings l
      JOIN agents a ON a.id = l.agent_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
    `, values);

    const countValues = values.slice(0, -2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM listings l WHERE ${where}`, countValues
    );

    res.json({
      total: parseInt(countRows[0].count),
      listings: rows.map(formatListing),
    });
  } catch (err) {
    console.error('GET /listings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, a.name AS agent_name, a.website AS agent_website
      FROM listings l
      JOIN agents a ON a.id = l.agent_id
      WHERE l.id = $1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json(formatListing(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/listings/cleanup — removes non-Manchester listings from the database
router.post('/cleanup', async (req, res) => {
  try {
    // Delete listings that are clearly not in Manchester:
    // 1. Non-M postcodes (S74, SL6, NW6, B92, etc.)
    // 2. Empty postcodes but street contains a known non-Manchester city
    const { rowCount } = await pool.query(`
      DELETE FROM listings
      WHERE (
        (postcode != '' AND postcode IS NOT NULL AND NOT (postcode ~ '^M\\d{1,2}\\s'))
        OR (
          (postcode IS NULL OR postcode = '')
          AND EXISTS (
            SELECT 1 FROM unnest(ARRAY[${BAD_CITIES}]) AS city
            WHERE LOWER(street) LIKE '%' || city || '%'
          )
        )
      )
    `);
    res.json({
      success: true,
      message: `Removed ${rowCount} non-Manchester listings`,
      removed: rowCount,
    });
  } catch (err) {
    console.error('POST /listings/cleanup error:', err.message);
    res.status(500).json({ error: 'Cleanup failed: ' + err.message });
  }
});

function formatListing(row) {
  return {
    id: row.id,
    price: row.price,
    beds: row.beds,
    type: row.type,
    area: row.area,
    street: row.street,
    postcode: row.postcode,
    description: row.description,
    photos: row.photos || [],
    features: row.features || [],
    furnished: row.furnished,
    parking: row.parking,
    pets: row.pets,
    garden: row.garden,
    balcony: row.balcony,
    listingUrl: row.listing_url,
    agent: row.agent_name,
    agentWebsite: row.agent_website,
    isNew: row.is_new,
    isPriceDrop: row.price_changed,
    originalPrice: row.original_price,
    listedAt: row.first_seen,
  };
}

module.exports = router;
