const cron    = require('node-cron');
const { pool } = require('./db');
const scrapers  = require('./scrapers');

// Upsert a batch of listings from one scraper run
async function saveListing(agentId, listing) {
  const {
    externalId, title, price, beds, type, area, street, postcode,
    description, photos, features, furnished, parking, pets, garden,
    balcony, listingUrl,
  } = listing;

  if (!price || isNaN(price)) return; // skip invalid

  try {
    // Check if listing already exists
    const existing = await pool.query(
      `SELECT id, price FROM listings WHERE agent_id = $1 AND external_id = $2`,
      [agentId, externalId]
    );

    if (existing.rows.length) {
      const old = existing.rows[0];
      const priceChanged = old.price !== price;
      await pool.query(`
        UPDATE listings SET
          title = $1, price = $2, beds = $3, type = $4, area = $5, street = $6,
          postcode = $7, description = $8, photos = $9, features = $10,
          furnished = $11, parking = $12, pets = $13, garden = $14, balcony = $15,
          listing_url = $16, last_seen = NOW(), is_active = true, is_new = false,
          price_changed = $17, original_price = CASE WHEN $17 THEN $18 ELSE original_price END
        WHERE agent_id = $19 AND external_id = $20
      `, [
        title, price, beds, type, area, street, postcode,
        description, JSON.stringify(photos || []), JSON.stringify(features || []),
        furnished, parking, pets, garden, balcony, listingUrl,
        priceChanged, priceChanged ? old.price : null,
        agentId, externalId
      ]);
    } else {
      await pool.query(`
        INSERT INTO listings
          (agent_id, external_id, title, price, beds, type, area, street, postcode,
           description, photos, features, furnished, parking, pets, garden, balcony,
           listing_url, is_new)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)
      `, [
        agentId, externalId, title, price, beds, type, area, street, postcode,
        description, JSON.stringify(photos || []), JSON.stringify(features || []),
        furnished, parking, pets, garden, balcony, listingUrl,
      ]);
    }
  } catch (err) {
    console.error(`  ✗ Failed to save listing ${externalId}:`, err.message);
  }
}

// Mark listings not seen in this run as inactive
async function deactivateStale(agentId, seenIds) {
  if (!seenIds.length) return;
  await pool.query(`
    UPDATE listings SET is_active = false
    WHERE agent_id = $1 AND external_id != ALL($2::text[]) AND is_active = true
  `, [agentId, seenIds]);
}

// Ensure all agents exist in the DB
async function seedAgents() {
  for (const scraper of scrapers) {
    await pool.query(`
      INSERT INTO agents (id, name, website, areas, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, website = EXCLUDED.website
    `, [scraper.id, scraper.name, scraper.website, scraper.areas || []]);
  }
}

const SCRAPER_TIMEOUT_MS = 55000; // 55 seconds max per scraper — prevents Railway OOM/hang

async function runScraper(scraper) {
  const start = Date.now();
  console.log(`▶ Scraping ${scraper.name}…`);

  try {
    const listings = await Promise.race([
      scraper.scrape(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Scraper timed out after 55s')), SCRAPER_TIMEOUT_MS)
      ),
    ]);
    const seenIds  = [];

    for (const listing of listings) {
      await saveListing(scraper.id, listing);
      if (listing.externalId) seenIds.push(listing.externalId);
    }

    await deactivateStale(scraper.id, seenIds);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ✓ ${scraper.name}: ${listings.length} listings in ${elapsed}s`);

    await pool.query(`
      UPDATE agents SET last_scraped = NOW(), listings_found = $1, status = 'active', error_msg = NULL
      WHERE id = $2
    `, [listings.length, scraper.id]);
  } catch (err) {
    console.error(`  ✗ ${scraper.name} failed:`, err.message);
    await pool.query(`
      UPDATE agents SET last_scraped = NOW(), status = 'error', error_msg = $1 WHERE id = $2
    `, [err.message.slice(0, 200), scraper.id]);
  }
}

async function runAll() {
  console.log(`\n🔄 Starting scrape run — ${new Date().toISOString()}`);
  await seedAgents();
  // Run scrapers sequentially to be polite to servers
  for (const scraper of scrapers) {
    await runScraper(scraper);
    // Small pause between scrapers
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('✅ Scrape run complete\n');
}

function startScheduler() {
  // Run immediately on startup, then every 20 minutes
  runAll();
  cron.schedule('*/20 * * * *', runAll);
  console.log('⏱  Scraper scheduled every 20 minutes');
}

// Allow running directly: node scheduler.js --once
if (require.main === module) {
  const { initDB } = require('./db');
  initDB().then(() => runAll()).then(() => process.exit(0));
}

module.exports = { startScheduler, runAll };
