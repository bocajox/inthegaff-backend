/**
 * scheduler.js — Memory-efficient scraper runner
 *
 * KEY CHANGES vs old version:
 * 1. Runs scrapers ONE AT A TIME (not parallel) to limit peak memory
 * 2. Saves each listing to DB immediately instead of collecting all into arrays
 * 3. Calls garbage collector between scrapers to free memory
 * 4. Monitors memory usage and logs warnings if getting high
 * 5. 55-second timeout per scraper to prevent hangs
 */

const { pool, initDB } = require('./db');
const scrapers = require('./scrapers');

const SCRAPER_TIMEOUT = 55000; // 55 seconds per scraper
const MEMORY_WARN_MB = 350;   // Warn if heap exceeds this

// ── Memory helpers ──────────────────────────────────────────────────────────
function memoryMB() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
  };
}

function tryGC() {
  if (global.gc) {
    global.gc();
    console.log('🧹 Garbage collection run');
  }
}

// ── Save one listing to the database ────────────────────────────────────────
async function saveListing(listing, agentId) {
  try {
    await pool.query(`
      INSERT INTO listings (
        agent_id, external_id, title, price, beds, type, area, street, postcode,
        description, photos, features, furnished, parking, pets,
        garden, balcony, listing_url, is_active, is_new, first_seen, last_seen
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, true, true, NOW(), NOW()
      )
      ON CONFLICT (agent_id, external_id) DO UPDATE SET
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        photos = EXCLUDED.photos,
        features = EXCLUDED.features,
        listing_url = EXCLUDED.listing_url,
        is_active = true,
        last_seen = NOW()
    `, [
      agentId,
      listing.externalId || listing.listingUrl || '',
      listing.title || '',
      listing.price || 0,
      listing.beds || 0,
      listing.type || 'flat',
      listing.area || '',
      listing.street || '',
      listing.postcode || '',
      listing.description || '',
      JSON.stringify(listing.photos || []),
      JSON.stringify(listing.features || []),
      listing.furnished || false,
      listing.parking || false,
      listing.pets || false,
      listing.garden || false,
      listing.balcony || false,
      listing.listingUrl || listing.listing_url || null,
    ]);
  } catch (err) {
    // Duplicate or constraint error — skip silently
    if (err.code !== '23505') {
      console.error(`   ⚠️  DB save error: ${err.message}`);
    }
  }
}

// ── Ensure agent exists in agents table ─────────────────────────────────────
async function ensureAgent(scraper) {
  await pool.query(
    `INSERT INTO agents (id, name, website)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       website = EXCLUDED.website,
       last_scraped = NOW()`,
    [scraper.id, scraper.name, scraper.website || '']
  );
  return scraper.id;
}

// ── Run one scraper with timeout ────────────────────────────────────────────
async function runOneScraper(scraper) {
  const startTime = Date.now();
  const mem = memoryMB();
  console.log(`\n🔍 Starting: ${scraper.name} (heap: ${mem.heapUsed}MB, rss: ${mem.rss}MB)`);

  if (mem.heapUsed > MEMORY_WARN_MB) {
    console.log(`   ⚠️  Memory high (${mem.heapUsed}MB) — running GC before scrape`);
    tryGC();
  }

  let timer;
  try {
    const agentId = await ensureAgent(scraper);

    // Run scraper with timeout (clear timer to avoid memory leak)
    const listings = await Promise.race([
      scraper.scrape(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), SCRAPER_TIMEOUT);
      }),
    ]);
    clearTimeout(timer);

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      console.log(`   ⚠️  ${scraper.name}: 0 listings returned`);
      return { name: scraper.name, count: 0 };
    }

    // Save each listing individually (not batch) to keep memory flat
    let saved = 0;
    for (const listing of listings) {
      if (listing.listingUrl || listing.listing_url) {
        await saveListing(listing, agentId);
        saved++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ ${scraper.name}: ${saved}/${listings.length} saved (${elapsed}s)`);

    // Update agent stats
    await pool.query(
      `UPDATE agents SET listings_found = $1, last_scraped = NOW(), status = 'active', error_msg = NULL WHERE id = $2`,
      [saved, agentId]
    );

    return { name: scraper.name, count: saved };

  } catch (err) {
    clearTimeout(timer);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (err.message === 'TIMEOUT') {
      console.error(`   ❌ ${scraper.name}: TIMED OUT after ${elapsed}s`);
    } else {
      console.error(`   ❌ ${scraper.name}: ${err.message} (${elapsed}s)`);
    }

    // Update agent error status
    try {
      await pool.query(
        `UPDATE agents SET status = 'error', error_msg = $1, last_scraped = NOW() WHERE id = $2`,
        [err.message.substring(0, 500), scraper.id]
      );
    } catch (e) { /* ignore */ }

    return { name: scraper.name, count: 0, error: err.message };
  }
}

// ── Run all scrapers sequentially ───────────────────────────────────────────
async function runAll() {
  console.log('\n══════════════════════════════════════════');
  console.log('🏠 InTheGaff Scraper Run Starting');
  console.log(`📊 Memory at start: ${JSON.stringify(memoryMB())}`);
  console.log(`📋 ${scrapers.length} scrapers registered`);
  console.log('══════════════════════════════════════════');

  const results = [];

  for (const scraper of scrapers) {
    const result = await runOneScraper(scraper);
    results.push(result);

    // Free memory between scrapers
    tryGC();

    // Small delay to let event loop breathe
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Mark old listings as inactive
  try {
    const { rowCount } = await pool.query(`
      UPDATE listings SET is_active = false
      WHERE last_seen < NOW() - INTERVAL '48 hours' AND is_active = true
    `);
    if (rowCount > 0) console.log(`\n🗑️  Marked ${rowCount} stale listings inactive`);
  } catch (err) {
    console.error('⚠️  Stale cleanup error:', err.message);
  }

  // Summary
  const total = results.reduce((sum, r) => sum + r.count, 0);
  const working = results.filter(r => r.count > 0).length;
  console.log('\n══════════════════════════════════════════');
  console.log(`✅ Done: ${total} listings from ${working}/${scrapers.length} scrapers`);
  console.log(`📊 Memory at end: ${JSON.stringify(memoryMB())}`);
  console.log('══════════════════════════════════════════\n');
}

// ── Cron-style scheduler (called by server.js) ─────────────────────────────
function startScheduler() {
  setInterval(() => {
    runAll().catch(err => console.error('💥 Scraper run failed:', err.message));
  }, 20 * 60 * 1000);
}

// ── Direct execution (forked or standalone) ─────────────────────────────────
if (require.main === module) {
  initDB()
    .then(() => runAll())
    .then(() => {
      console.log('Scraper process exiting cleanly');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Scraper process failed:', err.message);
      process.exit(1);
    });
}

module.exports = { startScheduler, runAll };
