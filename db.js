const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Run once on startup to create tables if they don't exist
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id          VARCHAR(60)  PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        website     VARCHAR(300),
        areas       TEXT[],
        last_scraped TIMESTAMPTZ,
        listings_found INTEGER DEFAULT 0,
        status      VARCHAR(20)  DEFAULT 'active',
        error_msg   TEXT
      );

      CREATE TABLE IF NOT EXISTS listings (
        id            SERIAL PRIMARY KEY,
        agent_id      VARCHAR(60) REFERENCES agents(id),
        external_id   VARCHAR(200),
        title         VARCHAR(300),
        price         INTEGER NOT NULL,
        beds          SMALLINT DEFAULT 1,
        type          VARCHAR(30) DEFAULT 'flat',
        area          VARCHAR(100),
        street        VARCHAR(250),
        postcode      VARCHAR(12),
        description   TEXT,
        photos        JSONB  DEFAULT '[]',
        features      JSONB  DEFAULT '[]',
        furnished     BOOLEAN DEFAULT false,
        parking       BOOLEAN DEFAULT false,
        pets          BOOLEAN DEFAULT false,
        garden        BOOLEAN DEFAULT false,
        balcony       BOOLEAN DEFAULT false,
        listing_url   VARCHAR(500),
        first_seen    TIMESTAMPTZ DEFAULT NOW(),
        last_seen     TIMESTAMPTZ DEFAULT NOW(),
        is_active     BOOLEAN DEFAULT true,
        is_new        BOOLEAN DEFAULT true,
        price_changed BOOLEAN DEFAULT false,
        original_price INTEGER,
        UNIQUE(agent_id, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_listings_area     ON listings(area);
      CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(price);
      CREATE INDEX IF NOT EXISTS idx_listings_active   ON listings(is_active);
      CREATE INDEX IF NOT EXISTS idx_listings_postcode ON listings(postcode);
    `);
    console.log('✅ Database ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
