require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDB } = require('./db');
const listingsRouter = require('./routes/listings');
const agentsRouter   = require('./routes/agents');
const statsRouter    = require('./routes/stats');
const { runAll }     = require('./scheduler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Crash protection ─────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'InTheGaff API', version: '2.0.0' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/listings', listingsRouter);
app.use('/api/agents',   agentsRouter);
app.use('/api/stats',    statsRouter);

// ── Scraper lock ─────────────────────────────────────────────────────────────
let scraperRunning = false;

async function runScrapers() {
  if (scraperRunning) {
    console.log('⏭  Scraper already running, skipping');
    return;
  }
  scraperRunning = true;
  try {
    await runAll();
  } catch (err) {
    console.error('💥 Scraper run failed:', err.message);
  } finally {
    scraperRunning = false;
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await initDB();
    app.listen(PORT, () => console.log(`🏠 InTheGaff API running on port ${PORT}`));

    // First scrape after 2 min (let server warm up), then every 60 min
    setTimeout(() => {
      runScrapers();
      setInterval(runScrapers, 60 * 60 * 1000);
    }, 2 * 60 * 1000);
  } catch (err) {
    console.error('💥 Startup failed:', err.message);
    process.exit(1);
  }
})();
